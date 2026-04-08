import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';

import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  paymentIntents,
  transactions,
  wallets,
} from '@common/database/schemas';
import { PaymentsConfig } from '@app/common/types/payments.types';

import {
  NormalizedEvent,
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './providers/payment-provider.interface';
import { TopupIntentResponseDto } from './dto/topup-intent-response.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly currency: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    configService: ConfigService,
  ) {
    const paymentsConfig = configService.get<PaymentsConfig>('payments', {
      infer: true,
    }) as PaymentsConfig;
    this.currency = paymentsConfig.currency;
  }

  // Get or lazy-create the user's wallet. One wallet per user, used across
  // every event they attend.
  private async getOrCreateWallet(userId: string) {
    const existing = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const wallet = existing[0];
      if (wallet.status !== 'active') {
        throw new BadRequestException(
          `Wallet is ${wallet.status}, cannot top up`,
        );
      }
      return wallet;
    }

    const inserted = await this.db
      .insert(wallets)
      .values({ userId })
      .returning();
    return inserted[0];
  }

  // Step 1 of the topup flow. The mobile app calls this, we ask the provider
  // for a payment intent, persist our own row, and return the client secret
  // so the mobile SDK can collect the card.
  async createTopupIntent(
    userId: string,
    amount: number,
  ): Promise<TopupIntentResponseDto> {
    const wallet = await this.getOrCreateWallet(userId);

    // Hand off to the provider. Metadata is stored on the provider side so
    // the webhook can tell us which wallet to credit even if our own DB row
    // got lost for some reason.
    const providerResult = await this.provider.createIntent({
      amount,
      currency: this.currency,
      description: `Wallet topup for user ${userId}`,
      metadata: {
        userId,
        walletId: wallet.id,
      },
    });

    const [saved] = await this.db
      .insert(paymentIntents)
      .values({
        userId,
        walletId: wallet.id,
        provider: this.provider.name,
        providerIntentId: providerResult.providerIntentId,
        amount,
        currency: this.currency,
        status: 'pending',
      })
      .returning();

    return {
      paymentIntentId: saved.id,
      clientSecret: providerResult.clientSecret,
      publishableKey: this.provider.publishableKey,
      provider: this.provider.name,
      currency: this.currency,
      amount,
    };
  }

  // Step 2 is fully provider-driven. The mobile SDK collects the card and
  // sends it to the provider directly, we never see card data. Once the
  // provider confirms, they call our webhook below.
  async handleWebhookEvent(event: NormalizedEvent): Promise<void> {
    switch (event.type) {
      case 'succeeded':
        await this.markIntentSucceeded(event);
        return;
      case 'failed':
        await this.markIntentFailed(event.providerIntentId, event.reason);
        return;
      case 'canceled':
        await this.markIntentCanceled(event.providerIntentId);
        return;
      case 'ignored':
        // Nothing to do. Still return 200 so the provider doesn't retry.
        return;
    }
  }

  private async markIntentSucceeded(event: NormalizedEvent): Promise<void> {
    if (event.type !== 'succeeded') return;

    const existing = await this.db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.providerIntentId, event.providerIntentId))
      .limit(1);

    if (existing.length === 0) {
      this.logger.warn(
        `Received succeeded event for unknown intent ${event.providerIntentId}`,
      );
      return;
    }

    const intent = existing[0];

    // Idempotent: if we already credited, do nothing. Stripe retries
    // webhooks aggressively so this must be safe to hit multiple times.
    if (intent.status === 'succeeded') {
      this.logger.log(`Intent ${intent.id} already succeeded, skipping`);
      return;
    }

    // Credit the wallet + create a wallet transaction + flip our row, all
    // in one DB transaction so we either do everything or nothing.
    await this.db.transaction(async (tx) => {
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${intent.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, intent.walletId));

      const [walletTx] = await tx
        .insert(transactions)
        .values({
          // eventId is null for topups, topup lives at the user level
          eventId: null,
          walletId: intent.walletId,
          type: 'topup_online',
          amount: intent.amount,
          status: 'completed',
          metadata: {
            provider: intent.provider,
            providerIntentId: intent.providerIntentId,
            paymentIntentId: intent.id,
          },
        })
        .returning();

      await tx
        .update(paymentIntents)
        .set({
          status: 'succeeded',
          transactionId: walletTx.id,
          updatedAt: new Date(),
        })
        .where(eq(paymentIntents.id, intent.id));
    });

    this.logger.log(
      `Credited wallet ${intent.walletId} with ${intent.amount} ${intent.currency}`,
    );
  }

  private async markIntentFailed(
    providerIntentId: string,
    reason: string,
  ): Promise<void> {
    await this.db
      .update(paymentIntents)
      .set({
        status: 'failed',
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(paymentIntents.providerIntentId, providerIntentId));
  }

  private async markIntentCanceled(providerIntentId: string): Promise<void> {
    await this.db
      .update(paymentIntents)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(paymentIntents.providerIntentId, providerIntentId));
  }
}
