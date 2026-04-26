import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';

import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  eventBracelets,
  paymentIntents,
  transactions,
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

  // Step 1 of the topup flow. The mobile app calls this with the bracelet
  // it is currently wearing, we ask the provider for a payment intent,
  // persist our own row, and return the client secret. The bracelet is the
  // wallet, so the bracelet id is what gets credited on webhook success.
  async createTopupIntent(
    userId: string,
    eventBraceletId: string,
    amount: number,
  ): Promise<TopupIntentResponseDto> {
    const bracelet = await this.requireOwnedActiveBracelet(
      userId,
      eventBraceletId,
    );

    const providerResult = await this.provider.createIntent({
      amount,
      currency: this.currency,
      description: `Bracelet topup for ${bracelet.id}`,
      metadata: {
        userId,
        eventBraceletId: bracelet.id,
      },
    });

    const [saved] = await this.db
      .insert(paymentIntents)
      .values({
        userId,
        eventBraceletId: bracelet.id,
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

    if (intent.status === 'succeeded') {
      this.logger.log(`Intent ${intent.id} already succeeded, skipping`);
      return;
    }

    // Credit the bracelet, bump credit_counter, write a transaction row,
    // flip the intent to succeeded — all atomic.
    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(eventBracelets)
        .set({
          balance: sql`${eventBracelets.balance} + ${intent.amount}`,
          creditCounter: sql`${eventBracelets.creditCounter} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(eventBracelets.id, intent.eventBraceletId))
        .returning({ creditCounter: eventBracelets.creditCounter });

      const newCreditCounter = updated[0].creditCounter;

      const [walletTx] = await tx
        .insert(transactions)
        .values({
          eventBraceletId: intent.eventBraceletId,
          type: 'credit',
          amount: intent.amount,
          status: 'completed',
          creditCounter: newCreditCounter,
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
      `Credited bracelet ${intent.eventBraceletId} with ${intent.amount} ${intent.currency}`,
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

  private async requireOwnedActiveBracelet(
    userId: string,
    eventBraceletId: string,
  ) {
    const rows = await this.db
      .select()
      .from(eventBracelets)
      .where(eq(eventBracelets.id, eventBraceletId))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('Bracelet not found');
    }
    const bracelet = rows[0];
    if (bracelet.userId !== userId) {
      throw new ForbiddenException('You can only top up your own bracelet');
    }
    if (bracelet.status !== 'active') {
      throw new BadRequestException(
        `Bracelet is ${bracelet.status}, cannot top up`,
      );
    }
    return bracelet;
  }
}
