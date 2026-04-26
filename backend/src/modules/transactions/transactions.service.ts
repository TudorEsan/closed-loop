import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

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

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly scope: ScopeService,
  ) {}

  // Online charge: terminal is connected, server is the source of truth.
  // We allocate the new debit_counter, decrement the balance and write
  // the transaction in one serializable DB transaction. The response
  // carries the fresh state so the terminal can write it to the chip.
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

        if (bracelet.balance < dto.amount) {
          throw new BadRequestException('Insufficient funds');
        }

        const newCounter = bracelet.debitCounterSeen + 1;
        const updated = await tx
          .update(eventBracelets)
          .set({
            balance: bracelet.balance - dto.amount,
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
            metadata: dto.deviceId ? { deviceId: dto.deviceId } : null,
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
}
