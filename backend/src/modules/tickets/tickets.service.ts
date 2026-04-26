import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';

import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  auditLogs,
  eventBracelets,
  eventMembers,
  eventTickets,
  events,
  users,
  wallets,
} from '@common/database/schemas';
import { EmailService } from '@common/email/email.service';
import { BraceletTokenService } from '../bracelets/bracelet-token.service';
import { IssueTicketDto } from './dto/issue-ticket.dto';
import { RedeemTicketDto } from './dto/redeem-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';

type DbError = { code?: string };

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as DbError).code === '23505';

const generateToken = () => randomBytes(24).toString('base64url');

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly tokens: BraceletTokenService,
    private readonly email: EmailService,
  ) {}

  async issue(
    eventId: string,
    adminId: string,
    adminRole: string,
    dto: IssueTicketDto,
    ipAddress: string | null,
  ) {
    const event = await this.requireManageableEvent(
      eventId,
      adminId,
      adminRole,
    );

    const normalizedEmail = dto.email.trim().toLowerCase();
    const expiresAt = this.tokens.expiryFromEventEnd(new Date(event.endDate));

    let ticket: typeof eventTickets.$inferSelect;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rows = await this.db
          .insert(eventTickets)
          .values({
            eventId,
            email: normalizedEmail,
            token: generateToken(),
            issuedBy: adminId,
            expiresAt,
          })
          .returning();
        ticket = rows[0];
        break;
      } catch (err) {
        if (!isUniqueViolation(err) || attempt === 2) {
          throw err;
        }
      }
    }

    try {
      await this.sendTicketEmail({
        ticketId: ticket!.id,
        token: ticket!.token,
        toEmail: normalizedEmail,
        toName: dto.name,
        eventName: event.name,
        eventStartDate: event.startDate,
        eventEndDate: event.endDate,
        eventLocation: event.location,
      });
      await this.db
        .update(eventTickets)
        .set({ sentAt: new Date(), updatedAt: new Date() })
        .where(eq(eventTickets.id, ticket!.id));
      ticket!.sentAt = new Date();
    } catch (err) {
      this.logger.error(
        `Failed to deliver ticket email for ${normalizedEmail}: ${(err as Error).message}`,
      );
    }

    await this.db.insert(auditLogs).values({
      eventId,
      userId: adminId,
      action: 'ticket.issue',
      entityType: 'event_ticket',
      entityId: ticket!.id,
      changes: { email: normalizedEmail },
      ipAddress,
    });

    return this.toPublic(ticket!);
  }

  async list(
    eventId: string,
    callerId: string,
    callerRole: string,
    query: ListTicketsDto,
  ) {
    await this.requireEventAccess(eventId, callerId, callerRole);

    const conditions: SQL<unknown>[] = [eq(eventTickets.eventId, eventId)];
    if (query.status) {
      conditions.push(eq(eventTickets.status, query.status));
    }
    if (query.search) {
      conditions.push(ilike(eventTickets.email, `%${query.search}%`));
    }

    const rows = await this.db
      .select()
      .from(eventTickets)
      .where(and(...conditions))
      .orderBy(desc(eventTickets.issuedAt))
      .limit(200);

    return { tickets: rows.map((r) => this.toPublic(r)) };
  }

  async revoke(
    eventId: string,
    ticketId: string,
    adminId: string,
    adminRole: string,
    ipAddress: string | null,
  ) {
    await this.requireManageableEvent(eventId, adminId, adminRole);
    const current = await this.requireTicket(eventId, ticketId);

    if (current.status !== 'pending') {
      throw new BadRequestException(
        `Cannot revoke a ticket in "${current.status}" status`,
      );
    }

    const updated = await this.db
      .update(eventTickets)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(eventTickets.id, ticketId))
      .returning();

    await this.db.insert(auditLogs).values({
      eventId,
      userId: adminId,
      action: 'ticket.revoke',
      entityType: 'event_ticket',
      entityId: ticketId,
      changes: { email: current.email },
      ipAddress,
    });

    return this.toPublic(updated[0]);
  }

  async redeem(
    operatorId: string,
    operatorRole: string,
    dto: RedeemTicketDto,
    ipAddress: string | null,
  ) {
    const ticket = await this.findByToken(dto.token);
    if (!ticket) {
      throw new NotFoundException('Ticket not found or already used');
    }

    const event = await this.requireEvent(ticket.eventId);
    const isAdmin = await this.isEventAdmin(
      event.id,
      operatorId,
      operatorRole,
      event.organizerId,
    );
    const isOperator =
      operatorRole === 'operator' &&
      (await this.isEventMember(event.id, operatorId));
    if (!isAdmin && !isOperator) {
      throw new ForbiddenException(
        'Only event admins or assigned operators can redeem tickets at the gate',
      );
    }

    if (event.status === 'closed') {
      throw new BadRequestException('Event is closed, tickets cannot be redeemed');
    }

    if (ticket.status === 'redeemed') {
      throw new ConflictException('This ticket has already been redeemed');
    }
    if (ticket.status === 'revoked') {
      throw new BadRequestException('This ticket has been revoked');
    }
    if (ticket.expiresAt.getTime() < Date.now()) {
      await this.db
        .update(eventTickets)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(eventTickets.id, ticket.id));
      throw new BadRequestException('This ticket has expired');
    }

    const userId = await this.upsertUserByEmail(ticket.email);
    const expiresAt = this.tokens.expiryFromEventEnd(new Date(event.endDate));

    let bracelet: typeof eventBracelets.$inferSelect;
    try {
      bracelet = await this.db.transaction(async (tx) => {
        const inserted = await tx
          .insert(eventBracelets)
          .values({
            eventId: event.id,
            userId,
            wristbandUid: dto.wristbandUid,
            linkedBy: operatorId,
            tokenExpiresAt: expiresAt,
          })
          .returning();

        await tx
          .update(eventTickets)
          .set({
            status: 'redeemed',
            redeemedAt: new Date(),
            redeemedBraceletId: inserted[0].id,
            userId,
            updatedAt: new Date(),
          })
          .where(eq(eventTickets.id, ticket.id));

        return inserted[0];
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          'This wristband is already linked at this event, or this user already has an active bracelet at this event',
        );
      }
      throw err;
    }

    await this.db.insert(auditLogs).values({
      eventId: event.id,
      userId: operatorId,
      action: 'ticket.redeem',
      entityType: 'event_ticket',
      entityId: ticket.id,
      changes: {
        ticketEmail: ticket.email,
        userId,
        wristbandUid: dto.wristbandUid,
        braceletId: bracelet.id,
      },
      ipAddress,
    });

    return {
      ticketId: ticket.id,
      eventId: event.id,
      eventName: event.name,
      email: ticket.email,
      userId,
      bracelet,
    };
  }

  // ---- helpers ----

  private toPublic(row: typeof eventTickets.$inferSelect) {
    return {
      id: row.id,
      eventId: row.eventId,
      email: row.email,
      status: row.status,
      issuedAt: row.issuedAt,
      sentAt: row.sentAt,
      expiresAt: row.expiresAt,
      redeemedAt: row.redeemedAt,
      revokedAt: row.revokedAt,
    };
  }

  private async findByToken(token: string) {
    const rows = await this.db
      .select()
      .from(eventTickets)
      .where(eq(eventTickets.token, token))
      .limit(1);
    return rows[0] ?? null;
  }

  private async requireTicket(eventId: string, ticketId: string) {
    const rows = await this.db
      .select()
      .from(eventTickets)
      .where(
        and(eq(eventTickets.id, ticketId), eq(eventTickets.eventId, eventId)),
      )
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('Ticket not found');
    }
    return rows[0];
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
        'Only super admins or event admins can manage tickets',
      );
    }
    if (event.status === 'closed') {
      throw new BadRequestException(
        'Event is closed, tickets cannot be issued',
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
    if (
      userRole === 'operator' &&
      (await this.isEventMember(eventId, userId))
    ) {
      return event;
    }
    throw new ForbiddenException('You do not have access to this event');
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
      .select({ id: eventMembers.id })
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

  private async isEventMember(
    eventId: string,
    userId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: eventMembers.id })
      .from(eventMembers)
      .where(
        and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)),
      )
      .limit(1);
    return rows.length > 0;
  }

  // Find or create the user behind a ticket's email. Created users are
  // attendees with a verified email (the email-verification happened
  // implicitly when the operator scanned a ticket sent to that address).
  // Wallet is provisioned alongside since the better-auth user.create
  // hook does not fire on direct inserts.
  private async upsertUserByEmail(email: string): Promise<string> {
    const existing = await this.db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      if (existing[0].isActive === false) {
        throw new BadRequestException(
          'The user behind this email is deactivated',
        );
      }
      return existing[0].id;
    }

    const id = crypto.randomUUID();
    const fallbackName = email.split('@')[0] || 'Attendee';
    await this.db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        email,
        name: fallbackName,
        emailVerified: true,
        role: 'attendee',
      });
      await tx
        .insert(wallets)
        .values({ userId: id })
        .onConflictDoNothing({ target: wallets.userId });
    });
    return id;
  }

  private async sendTicketEmail(args: {
    ticketId: string;
    token: string;
    toEmail: string;
    toName?: string;
    eventName: string;
    eventStartDate: string;
    eventEndDate: string;
    eventLocation: string | null;
  }) {
    const qrPng = await QRCode.toBuffer(args.token, {
      errorCorrectionLevel: 'M',
      width: 320,
      margin: 1,
    });
    const greeting = args.toName ? `Hi ${args.toName},` : 'Hello,';
    const dates = formatDateRange(args.eventStartDate, args.eventEndDate);
    const location = args.eventLocation
      ? `<p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">${escapeHtml(args.eventLocation)}</p>`
      : '';
    const dataUrl = `data:image/png;base64,${qrPng.toString('base64')}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 28px 24px;">
        <h2 style="margin: 0 0 4px; font-size: 22px;">${escapeHtml(args.eventName)}</h2>
        <p style="margin: 0; color: #6b7280; font-size: 13px;">${escapeHtml(dates)}</p>
        ${location}
        <p style="margin: 24px 0 8px;">${escapeHtml(greeting)}</p>
        <p style="margin: 0 0 20px;">
          Here is your ticket. Show this QR code at the festival gate. Staff will
          scan it and connect your wristband to your account.
        </p>
        <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 16px;">
          <img src="${dataUrl}" alt="Ticket QR" style="max-width: 280px; width: 100%; height: auto;" />
        </div>
        <p style="margin: 20px 0 0; color: #6b7280; font-size: 12px;">
          One ticket per person. Do not share this code, anyone with it can use
          your bracelet.
        </p>
      </div>
    `;

    await this.email.send({
      to: args.toEmail,
      subject: `Your ticket for ${args.eventName}`,
      html,
      attachments: [
        {
          filename: 'ticket.png',
          content: qrPng.toString('base64'),
          contentType: 'image/png',
        },
      ],
    });
  }
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateRange = (start: string, end: string) => {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return `${s.toLocaleDateString('en-GB', opts)} to ${e.toLocaleDateString(
      'en-GB',
      opts,
    )}`;
  } catch {
    return `${start} to ${end}`;
  }
};
