import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SQL, and, desc, eq, gt, lt, lte, sql } from 'drizzle-orm';

import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import { ScopeService } from '@common/auth/scope.service';
import {
  eventBracelets,
  transactions,
  vendors,
} from '@common/database/schemas';

import { ChargeDto } from './dto/charge.dto';

type DbError = { code?: string };
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as DbError).code === '23505';

const MINOR_UNITS_PER_MAJOR_UNIT = 100;

type SummaryBucket = {
  date: string;
  salesVolume: number;
  transactionCount: number;
};

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly scope: ScopeService,
  ) {}

  async charge(
    eventId: string,
    vendorId: string,
    callerId: string,
    callerRole: string,
    dto: ChargeDto,
  ) {
    await this.scope.requireVendorRole(callerId, callerRole, vendorId);

    const vendorRows = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);
    if (vendorRows.length === 0) {
      throw new NotFoundException('Vendor not found at this event');
    }
    if (vendorRows[0].status !== 'approved') {
      throw new ForbiddenException(
        `Vendor is ${vendorRows[0].status}, cannot charge`,
      );
    }

    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);

        const rows = await tx
          .select()
          .from(eventBracelets)
          .where(
            and(
              eq(eventBracelets.eventId, eventId),
              eq(eventBracelets.wristbandUid, dto.wristbandUid),
              eq(eventBracelets.status, 'active'),
            ),
          )
          .limit(1);
        if (rows.length === 0) {
          throw new NotFoundException(
            'No active bracelet for this UID at this event',
          );
        }
        const bracelet = rows[0];
        const chipState = dto.chipState;
        const chipDebitAhead =
          chipState.debit_counter > bracelet.debitCounterSeen;

        if (chipState.credit_counter_seen > bracelet.creditCounter) {
          throw new BadRequestException('Chip credit state is ahead of server');
        }

        const unseenCredits =
          chipDebitAhead &&
          chipState.credit_counter_seen < bracelet.creditCounter
            ? await this.sumCreditsAfterCounter(
                tx,
                bracelet.id,
                chipState.credit_counter_seen,
                bracelet.creditCounter,
              )
            : 0;
        const effectiveBalance = chipDebitAhead
          ? Math.min(bracelet.balance, chipState.balance + unseenCredits)
          : bracelet.balance;

        if (effectiveBalance < dto.amount) {
          throw new BadRequestException(
            `Insufficient funds, ${effectiveBalance} available`,
          );
        }

        const newCounter = chipDebitAhead
          ? chipState.debit_counter + 1
          : bracelet.debitCounterSeen + 1;
        const newBalance = effectiveBalance - dto.amount;
        const updated = await tx
          .update(eventBracelets)
          .set({
            balance: newBalance,
            debitCounterSeen: newCounter,
            updatedAt: new Date(),
          })
          .where(eq(eventBracelets.id, bracelet.id))
          .returning();

        const [inserted] = await tx
          .insert(transactions)
          .values({
            eventBraceletId: bracelet.id,
            vendorId,
            operatorId: callerId,
            type: 'debit',
            amount: dto.amount,
            status: 'completed',
            offline: false,
            debitCounter: newCounter,
            idempotencyKey: dto.idempotencyKey,
            metadata: this.chargeMetadata(dto.deviceId, chipDebitAhead, {
              serverBalanceBefore: bracelet.balance,
              serverDebitCounterSeenBefore: bracelet.debitCounterSeen,
              chipBalance: chipState.balance,
              chipDebitCounter: chipState.debit_counter,
              chipCreditCounterSeen: chipState.credit_counter_seen,
              unseenCreditsApplied: unseenCredits,
            }),
          })
          .returning();

        return {
          transaction: inserted,
          bracelet: {
            id: updated[0].id,
            balance: updated[0].balance,
            debit_counter_seen: updated[0].debitCounterSeen,
            credit_counter: updated[0].creditCounter,
          },
          chipShouldWrite: {
            balance: updated[0].balance,
            credit_counter: updated[0].creditCounter,
          },
        };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          'A transaction with this idempotency key already exists',
        );
      }
      throw err;
    }
  }

  private async sumCreditsAfterCounter(
    tx: Parameters<Parameters<DrizzleClient['transaction']>[0]>[0],
    eventBraceletId: string,
    afterCounter: number,
    upToCounter: number,
  ): Promise<number> {
    const creditRows = await tx
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.eventBraceletId, eventBraceletId),
          eq(transactions.type, 'credit'),
          gt(transactions.creditCounter, afterCounter),
          lte(transactions.creditCounter, upToCounter),
        ),
      );

    return creditRows.reduce((sum, row) => sum + row.amount, 0);
  }

  private chargeMetadata(
    deviceId: string | undefined,
    chipDebitAhead: boolean,
    chipReconciliation: {
      serverBalanceBefore: number;
      serverDebitCounterSeenBefore: number;
      chipBalance: number;
      chipDebitCounter: number;
      chipCreditCounterSeen: number;
      unseenCreditsApplied: number;
    },
  ): Record<string, unknown> | null {
    const metadata: Record<string, unknown> = {};
    if (deviceId) metadata.deviceId = deviceId;
    if (chipDebitAhead) {
      metadata.chipReconciliation = chipReconciliation;
    }
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  async listForVendor(
    eventId: string,
    vendorId: string,
    callerId: string,
    callerRole: string,
    params: { limit?: number; cursor?: string } = {},
  ) {
    await this.scope.requireVendorRole(callerId, callerRole, vendorId);

    const vendorRows = await this.db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);
    if (vendorRows.length === 0) {
      throw new NotFoundException('Vendor not found at this event');
    }

    const limit = Math.min(params.limit ?? 20, 100);
    const conditions: SQL<unknown>[] = [eq(transactions.vendorId, vendorId)];

    if (params.cursor) {
      const cursorRow = await this.db
        .select({ createdAt: transactions.createdAt })
        .from(transactions)
        .where(eq(transactions.id, params.cursor))
        .limit(1);
      if (cursorRow.length > 0) {
        conditions.push(lt(transactions.createdAt, cursorRow[0].createdAt));
      }
    }

    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { transactions: items, nextCursor };
  }

  async getEventSummary(eventId: string, callerId: string, callerRole: string) {
    const { event } = await this.scope.requireEventRole(
      callerId,
      callerRole,
      eventId,
    );

    const [totals] = await this.db
      .select({
        salesVolumeTokens: sql<number>`
          coalesce(sum(
            case
              when ${transactions.type} = 'debit'
                and ${transactions.status} = 'completed'
              then ${transactions.amount}
              else 0
            end
          ), 0)
        `,
        transactionCount: sql<number>`
          count(*) filter (where ${transactions.status} = 'completed')
        `,
      })
      .from(transactions)
      .innerJoin(
        eventBracelets,
        eq(eventBracelets.id, transactions.eventBraceletId),
      )
      .where(eq(eventBracelets.eventId, eventId));

    const buckets = await this.db
      .select({
        date: sql<string>`date_trunc('day', ${transactions.createdAt})::date`,
        salesVolumeTokens: sql<number>`
          coalesce(sum(
            case
              when ${transactions.type} = 'debit'
                and ${transactions.status} = 'completed'
              then ${transactions.amount}
              else 0
            end
          ), 0)
        `,
        transactionCount: sql<number>`
          count(*) filter (where ${transactions.status} = 'completed')
        `,
      })
      .from(transactions)
      .innerJoin(
        eventBracelets,
        eq(eventBracelets.id, transactions.eventBraceletId),
      )
      .where(eq(eventBracelets.eventId, eventId))
      .groupBy(sql`date_trunc('day', ${transactions.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${transactions.createdAt})::date`);

    const tokenRate = Number(event.tokenCurrencyRate);
    const toCurrency = (amountMinor: number | string | null) =>
      (Number(amountMinor ?? 0) / MINOR_UNITS_PER_MAJOR_UNIT) * tokenRate;

    return {
      salesVolume: toCurrency(totals?.salesVolumeTokens ?? 0),
      transactionCount: Number(totals?.transactionCount ?? 0),
      currency: event.currency,
      buckets: buckets.map(
        (bucket): SummaryBucket => ({
          date: bucket.date,
          salesVolume: toCurrency(bucket.salesVolumeTokens),
          transactionCount: Number(bucket.transactionCount),
        }),
      ),
    };
  }
}
