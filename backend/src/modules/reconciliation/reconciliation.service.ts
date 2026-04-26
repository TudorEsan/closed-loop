import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import { eventBracelets, transactions } from '@common/database/schemas';
import { ScopeService } from '@common/auth/scope.service';

import { PendingDebitDto, SyncRequestDto } from './dto/sync.dto';

type RejectReason =
  | 'duplicate'
  | 'insufficient_funds'
  | 'counter_gap'
  | 'invalid';

export type SyncResponse = {
  serverState: {
    balance: number;
    debit_counter_seen: number;
    credit_counter: number;
  };
  applied: string[];
  rejected: { idempotencyKey: string; reason: RejectReason }[];
  chipShouldWrite: {
    balance: number;
    credit_counter: number;
  };
};

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly scope: ScopeService,
  ) {}

  async sync(
    eventId: string,
    wristbandUid: string,
    callerId: string,
    callerRole: string,
    payload: SyncRequestDto,
  ): Promise<SyncResponse> {
    // Any operator at the event or any vendor cashier at this event can hit
    // this endpoint, since both run softpos terminals.
    await this.scope.requireEventOrVendorAccess(callerId, callerRole, eventId);

    const sortedDebits = [...(payload.pendingDebits ?? [])].sort(
      (a, b) => a.counterValue - b.counterValue,
    );

    const applied: string[] = [];
    const rejected: { idempotencyKey: string; reason: RejectReason }[] = [];

    const finalBracelet = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);

      const rows = await tx
        .select()
        .from(eventBracelets)
        .where(
          and(
            eq(eventBracelets.eventId, eventId),
            eq(eventBracelets.wristbandUid, wristbandUid),
            eq(eventBracelets.status, 'active'),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        throw new NotFoundException(
          'No active bracelet for this UID at this event',
        );
      }

      let bracelet = rows[0];

      for (const debit of sortedDebits) {
        const outcome = await this.applyDebit(tx, bracelet, debit);
        if (outcome.kind === 'applied') {
          applied.push(debit.idempotencyKey);
          bracelet = outcome.bracelet;
        } else {
          rejected.push({
            idempotencyKey: debit.idempotencyKey,
            reason: outcome.reason,
          });
        }
      }

      return bracelet;
    });

    return {
      serverState: {
        balance: finalBracelet.balance,
        debit_counter_seen: finalBracelet.debitCounterSeen,
        credit_counter: finalBracelet.creditCounter,
      },
      applied,
      rejected,
      chipShouldWrite: {
        balance: finalBracelet.balance,
        credit_counter: finalBracelet.creditCounter,
      },
    };
  }

  private async applyDebit(
    tx: Parameters<Parameters<DrizzleClient['transaction']>[0]>[0],
    bracelet: typeof eventBracelets.$inferSelect,
    debit: PendingDebitDto,
  ): Promise<
    | { kind: 'applied'; bracelet: typeof eventBracelets.$inferSelect }
    | { kind: 'rejected'; reason: RejectReason }
  > {
    const dup = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.idempotencyKey, debit.idempotencyKey))
      .limit(1);
    if (dup.length > 0) {
      return { kind: 'rejected', reason: 'duplicate' };
    }

    if (debit.counterValue <= bracelet.debitCounterSeen) {
      return { kind: 'rejected', reason: 'duplicate' };
    }

    if (bracelet.balance < debit.amount) {
      return { kind: 'rejected', reason: 'insufficient_funds' };
    }

    const updated = await tx
      .update(eventBracelets)
      .set({
        balance: bracelet.balance - debit.amount,
        debitCounterSeen: debit.counterValue,
        updatedAt: new Date(),
      })
      .where(eq(eventBracelets.id, bracelet.id))
      .returning();

    await tx.insert(transactions).values({
      eventBraceletId: bracelet.id,
      vendorId: debit.vendorId,
      type: 'debit',
      amount: debit.amount,
      status: 'completed',
      offline: true,
      debitCounter: debit.counterValue,
      idempotencyKey: debit.idempotencyKey,
      clientTimestamp: new Date(debit.clientTimestamp),
      metadata: { deviceId: debit.deviceId },
    });

    return { kind: 'applied', bracelet: updated[0] };
  }
}
