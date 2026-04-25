import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, lt, or, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  auditLogs,
  eventBracelets,
  eventMembers,
  events,
  users,
  vendors,
  vendorMembers,
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
  ) {}

  async link(
    eventId: string,
    adminId: string,
    adminRole: string,
    dto: LinkBraceletDto,
    ipAddress: string | null,
  ) {
    const event = await this.requireManageableEvent(
      eventId,
      adminId,
      adminRole,
    );

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
    adminId: string,
    adminRole: string,
    query: ListBraceletsDto,
  ) {
    await this.requireEventAccess(eventId, adminId, adminRole);

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
    adminId: string,
    adminRole: string,
  ) {
    await this.requireEventAccess(eventId, adminId, adminRole);
    return this.requireAssignment(eventId, assignmentId);
  }

  async findByUid(
    eventId: string,
    uid: string,
    adminId: string,
    adminRole: string,
  ) {
    await this.requireEventAccess(eventId, adminId, adminRole);

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
    await this.requireManageableEvent(eventId, adminId, adminRole);
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
    const event = await this.requireManageableEvent(
      eventId,
      adminId,
      adminRole,
    );
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

  async syncBundle(eventId: string, callerId: string, callerRole: string) {
    await this.requireEventAccess(eventId, callerId, callerRole);

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

  private async requireManageableEvent(
    eventId: string,
    userId: string,
    userRole: string,
  ) {
    const event = await this.requireEvent(eventId);
    const allowed = await this.isEventAdmin(
      eventId,
      userId,
      userRole,
      event.organizerId,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only super admins or event admins can manage bracelets',
      );
    }
    if (event.status === 'closed') {
      throw new BadRequestException(
        'Event is closed, bracelet links cannot change',
      );
    }
    return event;
  }

  private async requireEventAccess(
    eventId: string,
    userId: string,
    userRole: string,
  ) {
    const event = await this.requireEvent(eventId);
    if (userRole === 'super_admin') return event;

    if (await this.isEventAdmin(eventId, userId, userRole, event.organizerId)) {
      return event;
    }

    if (userRole === 'vendor' || userRole === 'operator') {
      if (await this.isVendorMemberAtEvent(eventId, userId)) return event;
    }

    throw new ForbiddenException('You do not have access to this event');
  }

  private async isVendorMemberAtEvent(
    eventId: string,
    userId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: vendorMembers.id })
      .from(vendorMembers)
      .innerJoin(vendors, eq(vendors.id, vendorMembers.vendorId))
      .where(
        and(eq(vendorMembers.userId, userId), eq(vendors.eventId, eventId)),
      )
      .limit(1);
    return rows.length > 0;
  }

  private async requireEvent(eventId: string) {
    const event = await this.db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    if (event.length === 0) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }
    return event[0];
  }

  private async isEventAdmin(
    eventId: string,
    userId: string,
    userRole: string,
    organizerId: string,
  ): Promise<boolean> {
    if (userRole === 'super_admin') return true;
    if (organizerId === userId) return true;

    const membership = await this.db
      .select()
      .from(eventMembers)
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, userId),
          or(
            eq(eventMembers.role, 'organizer'),
            eq(eventMembers.role, 'admin'),
          ),
        ),
      )
      .limit(1);

    return membership.length > 0;
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
