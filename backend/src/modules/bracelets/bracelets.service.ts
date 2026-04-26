import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, lt, or, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import { ScopeService } from '@common/auth/scope.service';
import {
  auditLogs,
  eventBracelets,
  events,
  transactions,
  users,
} from '@common/database/schemas';
import { LinkBraceletDto } from './dto/link-bracelet.dto';
import { ReplaceBraceletDto } from './dto/replace-bracelet.dto';
import { RevokeBraceletDto } from './dto/revoke-bracelet.dto';
import { ListBraceletsDto } from './dto/list-bracelets.dto';
import {
  BraceletTokenService,
  BraceletTokenPayload,
} from './bracelet-token.service';

type DbError = { code?: string };

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as DbError).code === '23505';

@Injectable()
export class BraceletsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly tokens: BraceletTokenService,
    private readonly scope: ScopeService,
  ) {}

  async link(
    eventId: string,
    adminId: string,
    adminRole: string,
    dto: LinkBraceletDto,
    ipAddress: string | null,
  ) {
    const { event } = await this.scope.requireEventRole(
      adminId,
      adminRole,
      eventId,
      'admin',
    );
    this.assertEventOpen(event.status);

    const targetUser = await this.db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);

    if (targetUser.length === 0) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }
    if (targetUser[0].isActive === false) {
      throw new BadRequestException(
        'Cannot link a bracelet to a deactivated user',
      );
    }

    const expiresAt = this.tokens.expiryFromEventEnd(new Date(event.endDate));

    let inserted: typeof eventBracelets.$inferSelect;
    try {
      const rows = await this.db
        .insert(eventBracelets)
        .values({
          eventId,
          userId: dto.userId,
          wristbandUid: dto.wristbandUid,
          linkedBy: adminId,
          tokenExpiresAt: expiresAt,
        })
        .returning();
      inserted = rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          'This wristband is already linked at this event, or this user already has an active bracelet at this event',
        );
      }
      throw err;
    }

    await this.writeAudit({
      eventId,
      actorId: adminId,
      action: 'bracelet.link',
      assignmentId: inserted.id,
      changes: { userId: dto.userId, wristbandUid: dto.wristbandUid },
      ipAddress,
    });

    return this.toAssignmentWithToken(inserted);
  }

  async list(
    eventId: string,
    callerId: string,
    callerRole: string,
    query: ListBraceletsDto,
  ) {
    await this.scope.requireEventRole(callerId, callerRole, eventId);

    const { status, search, limit = 20, cursor } = query;
    const conditions: SQL<unknown>[] = [eq(eventBracelets.eventId, eventId)];

    if (status) {
      conditions.push(eq(eventBracelets.status, status));
    }

    if (search) {
      const wildcard = `%${search}%`;
      conditions.push(
        or(
          ilike(eventBracelets.wristbandUid, wildcard),
          ilike(users.name, wildcard),
          ilike(users.email, wildcard),
        )!,
      );
    }

    if (cursor) {
      const cursorRow = await this.db
        .select({ linkedAt: eventBracelets.linkedAt })
        .from(eventBracelets)
        .where(eq(eventBracelets.id, cursor))
        .limit(1);
      if (cursorRow.length > 0) {
        conditions.push(lt(eventBracelets.linkedAt, cursorRow[0].linkedAt));
      }
    }

    const rows = await this.db
      .select({
        assignment: eventBracelets,
        user: { id: users.id, name: users.name, email: users.email },
      })
      .from(eventBracelets)
      .leftJoin(users, eq(users.id, eventBracelets.userId))
      .where(and(...conditions))
      .orderBy(desc(eventBracelets.linkedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].assignment.id : null;

    return {
      bracelets: items.map((r) => ({ ...r.assignment, user: r.user })),
      nextCursor,
    };
  }

  async findOne(
    eventId: string,
    assignmentId: string,
    callerId: string,
    callerRole: string,
  ) {
    await this.scope.requireEventRole(callerId, callerRole, eventId);
    return this.requireAssignment(eventId, assignmentId);
  }

  async findByUid(
    eventId: string,
    uid: string,
    callerId: string,
    callerRole: string,
  ) {
    // Vendor cashiers also need to look up bracelets at the gate, so this
    // accepts both event members and vendor members.
    await this.scope.requireEventOrVendorAccess(callerId, callerRole, eventId);

    const rows = await this.db
      .select()
      .from(eventBracelets)
      .where(
        and(
          eq(eventBracelets.eventId, eventId),
          eq(eventBracelets.wristbandUid, uid),
          eq(eventBracelets.status, 'active'),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(
        'No active bracelet assignment for this UID at this event',
      );
    }

    return this.toAssignmentWithToken(rows[0]);
  }

  async revoke(
    eventId: string,
    assignmentId: string,
    adminId: string,
    adminRole: string,
    dto: RevokeBraceletDto,
    ipAddress: string | null,
  ) {
    const { event } = await this.scope.requireEventRole(
      adminId,
      adminRole,
      eventId,
      'admin',
    );
    this.assertEventOpen(event.status);

    const current = await this.requireAssignment(eventId, assignmentId);

    if (current.status !== 'active') {
      throw new BadRequestException(
        `Cannot revoke a bracelet in "${current.status}" status`,
      );
    }

    const updated = await this.db
      .update(eventBracelets)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: adminId,
        revokeReason: dto.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(eventBracelets.id, assignmentId))
      .returning();

    await this.writeAudit({
      eventId,
      actorId: adminId,
      action: 'bracelet.revoke',
      assignmentId,
      changes: {
        reason: dto.reason ?? null,
        previousUid: current.wristbandUid,
      },
      ipAddress,
    });

    return updated[0];
  }

  async replace(
    eventId: string,
    assignmentId: string,
    adminId: string,
    adminRole: string,
    dto: ReplaceBraceletDto,
    ipAddress: string | null,
  ) {
    const { event } = await this.scope.requireEventRole(
      adminId,
      adminRole,
      eventId,
      'admin',
    );
    this.assertEventOpen(event.status);

    const current = await this.requireAssignment(eventId, assignmentId);

    if (current.status !== 'active') {
      throw new BadRequestException(
        `Cannot replace a bracelet in "${current.status}" status`,
      );
    }

    const expiresAt = this.tokens.expiryFromEventEnd(new Date(event.endDate));

    try {
      return await this.db.transaction(async (tx) => {
        const newRows = await tx
          .insert(eventBracelets)
          .values({
            eventId,
            userId: current.userId,
            wristbandUid: dto.wristbandUid,
            linkedBy: adminId,
            tokenExpiresAt: expiresAt,
          })
          .returning();
        const next = newRows[0];

        await tx
          .update(eventBracelets)
          .set({
            status: 'replaced',
            revokedAt: new Date(),
            revokedBy: adminId,
            revokeReason: dto.reason ?? null,
            replacedByAssignmentId: next.id,
            updatedAt: new Date(),
          })
          .where(eq(eventBracelets.id, assignmentId));

        await tx.insert(auditLogs).values({
          eventId,
          userId: adminId,
          action: 'bracelet.replace',
          entityType: 'event_bracelet',
          entityId: next.id,
          changes: {
            previousAssignmentId: assignmentId,
            previousUid: current.wristbandUid,
            newUid: dto.wristbandUid,
            reason: dto.reason ?? null,
          },
          ipAddress,
        });

        return {
          previous: {
            ...current,
            status: 'replaced' as const,
            replacedByAssignmentId: next.id,
          },
          current: this.toAssignmentWithToken(next),
        };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          'This wristband is already linked at this event, or this user already has an active bracelet at this event',
        );
      }
      throw err;
    }
  }

  // Attendee-facing list of their active bracelets across events. Each row
  // carries the live balance and the counters since the bracelet IS the
  // wallet now.
  async myBracelets(userId: string) {
    const rows = await this.db
      .select({
        bracelet: eventBracelets,
        eventName: events.name,
      })
      .from(eventBracelets)
      .innerJoin(events, eq(events.id, eventBracelets.eventId))
      .where(
        and(
          eq(eventBracelets.userId, userId),
          eq(eventBracelets.status, 'active'),
        ),
      )
      .orderBy(desc(eventBracelets.linkedAt));
    return {
      bracelets: rows.map((r) => ({ ...r.bracelet, eventName: r.eventName })),
    };
  }

  async myBraceletTransactions(
    userId: string,
    braceletId: string,
    params: { limit?: number; cursor?: string } = {},
  ) {
    const owned = await this.db
      .select()
      .from(eventBracelets)
      .where(
        and(
          eq(eventBracelets.id, braceletId),
          eq(eventBracelets.userId, userId),
        ),
      )
      .limit(1);
    if (owned.length === 0) {
      throw new NotFoundException('Bracelet not found');
    }

    const limit = Math.min(params.limit ?? 20, 100);
    const conditions: SQL<unknown>[] = [
      eq(transactions.eventBraceletId, braceletId),
    ];
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

  async myTransactions(
    userId: string,
    params: { limit?: number; cursor?: string } = {},
  ) {
    const limit = Math.min(params.limit ?? 20, 100);
    const conditions: SQL<unknown>[] = [eq(eventBracelets.userId, userId)];
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
      .select({
        transaction: transactions,
        eventId: events.id,
        eventName: events.name,
      })
      .from(transactions)
      .innerJoin(
        eventBracelets,
        eq(eventBracelets.id, transactions.eventBraceletId),
      )
      .innerJoin(events, eq(events.id, eventBracelets.eventId))
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? items[items.length - 1].transaction.id
      : null;

    return {
      transactions: items.map((r) => ({
        ...r.transaction,
        eventId: r.eventId,
        eventName: r.eventName,
      })),
      nextCursor,
    };
  }

  async myEvents(userId: string) {
    const rows = await this.db
      .select({
        id: events.id,
        name: events.name,
        startDate: events.startDate,
        endDate: events.endDate,
        status: events.status,
        location: events.location,
        linkedWristbandUid: eventBracelets.wristbandUid,
      })
      .from(eventBracelets)
      .innerJoin(events, eq(events.id, eventBracelets.eventId))
      .where(
        and(
          eq(eventBracelets.userId, userId),
          eq(eventBracelets.status, 'active'),
        ),
      )
      .orderBy(desc(events.startDate));

    return { events: rows };
  }

  async syncBundle(eventId: string, callerId: string, callerRole: string) {
    await this.scope.requireEventOrVendorAccess(callerId, callerRole, eventId);

    const rows = await this.db
      .select()
      .from(eventBracelets)
      .where(
        and(
          eq(eventBracelets.eventId, eventId),
          eq(eventBracelets.status, 'active'),
        ),
      )
      .orderBy(desc(eventBracelets.linkedAt));

    return {
      eventId,
      generatedAt: new Date().toISOString(),
      assignments: rows.map((r) => this.toAssignmentWithToken(r)),
    };
  }

  // ---- Helpers ----

  private assertEventOpen(status: string) {
    if (status === 'closed') {
      throw new BadRequestException(
        'Event is closed, bracelet links cannot change',
      );
    }
  }

  private toAssignmentWithToken(row: typeof eventBracelets.$inferSelect) {
    const payload: BraceletTokenPayload = {
      assignmentId: row.id,
      eventId: row.eventId,
      userId: row.userId,
      wristbandUid: row.wristbandUid,
      issuedAt: row.tokenIssuedAt.getTime(),
      expiresAt: row.tokenExpiresAt.getTime(),
      v: row.tokenVersion,
    };
    return {
      ...row,
      token: row.status === 'active' ? this.tokens.issue(payload) : null,
    };
  }

  private async requireAssignment(eventId: string, assignmentId: string) {
    const rows = await this.db
      .select()
      .from(eventBracelets)
      .where(
        and(
          eq(eventBracelets.id, assignmentId),
          eq(eventBracelets.eventId, eventId),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('Bracelet assignment not found');
    }
    return rows[0];
  }

  private async writeAudit(args: {
    eventId: string;
    actorId: string;
    action: string;
    assignmentId: string;
    changes: Record<string, unknown>;
    ipAddress: string | null;
  }) {
    await this.db.insert(auditLogs).values({
      eventId: args.eventId,
      userId: args.actorId,
      action: args.action,
      entityType: 'event_bracelet',
      entityId: args.assignmentId,
      changes: args.changes,
      ipAddress: args.ipAddress,
    });
  }
}
