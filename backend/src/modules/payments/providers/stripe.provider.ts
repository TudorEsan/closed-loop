import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Stripe ships as CommonJS. Under module:nodenext + no esModuleInterop the
// nicest way to bring in both the constructor and its types is the TS
// require form. The cjs typings expose the constructor as a callable, so
// we cast to a proper class signature for the `new` call below.
import StripeNs = require('stripe');

import {
  CreateIntentParams,
  CreateIntentResult,
  NormalizedEvent,
  PaymentProvider,
} from './payment-provider.interface';
import { PaymentsConfig } from '@app/common/types/payments.types';

type StripePaymentIntentLike = {
  id: string;
  client_secret: string | null;
  amount: number;
  currency: string;
  metadata: Record<string, string> | null;
  last_payment_error?: { message?: string } | null;
};

type StripeEventLike = {
  type: string;
  data: { object: unknown };
};

type StripeClient = {
  paymentIntents: {
    create(params: {
      amount: number;
      currency: string;
      description?: string;
      metadata: Record<string, string>;
      automatic_payment_methods: { enabled: boolean };
    }): Promise<StripePaymentIntentLike>;
  };
  webhooks: {
    constructEvent(
      payload: string | Buffer,
      header: string,
      secret: string,
    ): StripeEventLike;
  };
};

type StripeConstructorLike = new (
  apiKey: string,
  config?: { apiVersion?: string; typescript?: boolean },
) => StripeClient;

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly publishableKey: string;

  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: StripeClient;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    const paymentsConfig = configService.get<PaymentsConfig>('payments', {
      infer: true,
    }) as PaymentsConfig;

    if (!paymentsConfig.stripe.secretKey) {
      // Don't throw so the app can boot without stripe keys in a fresh
      // dev setup. Real calls will fail with a clear error below.
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set. Payments will not work until you set it in .env',
      );
    }

    const Ctor = StripeNs as unknown as StripeConstructorLike;
    this.stripe = new Ctor(paymentsConfig.stripe.secretKey, {
      // Pinning the api version so Stripe doesn't change shapes under us.
      apiVersion: '2025-09-30.clover',
      typescript: true,
    });
    this.publishableKey = paymentsConfig.stripe.publishableKey;
    this.webhookSecret = paymentsConfig.stripe.webhookSecret;
  }

  async createIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      metadata: params.metadata,
      // Lets Stripe pick the right method for the user's country, the
      // mobile PaymentSheet handles the UI.
      automatic_payment_methods: { enabled: true },
    });

    if (!intent.client_secret) {
      throw new BadRequestException('Stripe did not return a client secret');
    }

    return {
      providerIntentId: intent.id,
      clientSecret: intent.client_secret,
    };
  }

  parseWebhook(rawBody: Buffer, signature: string): NormalizedEvent {
    if (!this.webhookSecret) {
      throw new BadRequestException(
        'STRIPE_WEBHOOK_SECRET is not configured on the server',
      );
    }

    let event: StripeEventLike;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Stripe webhook signature failed: ${message}`);
      throw new BadRequestException(`Invalid webhook signature: ${message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as StripePaymentIntentLike;
        return {
          type: 'succeeded',
          providerIntentId: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          metadata: pi.metadata ?? {},
        };
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as StripePaymentIntentLike;
        return {
          type: 'failed',
          providerIntentId: pi.id,
          reason:
            pi.last_payment_error?.message ?? 'Payment failed at provider',
        };
      }
      case 'payment_intent.canceled': {
        const pi = event.data.object as StripePaymentIntentLike;
        return {
          type: 'canceled',
          providerIntentId: pi.id,
        };
      }
      default:
        return { type: 'ignored' };
    }
  }
}
