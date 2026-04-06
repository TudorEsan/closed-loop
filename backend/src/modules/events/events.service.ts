import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  events,
  eventMembers,
  users,
  vendors,
} from '@common/database/schemas';
import { eq, and, or, ilike, desc, lt, count, type SQL } from 'drizzle-orm';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { AddMemberDto } from './dto/add-member.dto';

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Math.random().toString(36).substring(2, 8)
  );
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['setup'],
  setup: ['active'],
  active: ['settlement'],
  settlement: ['closed'],
  closed: [],
};

@Injectable()
export class EventsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(userId: string, dto: CreateEventDto) {
    const slug = generateSlug(dto.name);

    const result = await this.db
      .insert(events)
      .values({
        name: dto.name,
        slug,
        description: dto.description,
        organizerId: userId,
        currency: dto.currency ?? 'EUR',
        tokenCurrencyRate: String(dto.tokenCurrencyRate),
        maxTransactionAmount: dto.maxTransactionAmount,
        maxOfflineSpend: dto.maxOfflineSpend,
        defaultCommissionRate: dto.defaultCommissionRate
          ? String(dto.defaultCommissionRate)
          : '0',
        startDate: dto.startDate,
        endDate: dto.endDate,
        timezone: dto.timezone ?? 'Europe/Bucharest',
        location: dto.location,
      })
      .returning();

    return result[0];
  }

  async findAll(userId: string, userRole: string, query: EventQueryDto) {
    const { status, search, limit = 20, cursor } = query;

    const conditions: SQL<unknown>[] = [];

    // Access control based on role
    if (userRole === 'admin') {
      const memberEventIds = await this.db
        .select({ eventId: eventMembers.eventId })
        .from(eventMembers)
        .where(eq(eventMembers.userId, userId));

      const memberIds = memberEventIds.map((m) => m.eventId);

      if (memberIds.length > 0) {
        const accessCondition = or(
          eq(events.organizerId, userId),
          ...memberIds.map((id) => eq(events.id, id)),
        );
        if (accessCondition) conditions.push(accessCondition);
      } else {
        conditions.push(eq(events.organizerId, userId));
      }
    } else if (userRole === 'operator') {
      const memberEventIds = await this.db
        .select({ eventId: eventMembers.eventId })
        .from(eventMembers)
        .where(eq(eventMembers.userId, userId));

      const memberIds = memberEventIds.map((m) => m.eventId);

      if (memberIds.length > 0) {
        const accessCondition = or(...memberIds.map((id) => eq(events.id, id)));
        if (accessCondition) conditions.push(accessCondition);
      } else {
        return { events: [], nextCursor: null };
      }
    }

    if (status) {
      conditions.push(eq(events.status, status));
    }

    if (search) {
      conditions.push(ilike(events.name, `%${search}%`));
    }

    if (cursor) {
      const cursorEvent = await this.db
        .select({ createdAt: events.createdAt })
        .from(events)
        .where(eq(events.id, cursor))
        .limit(1);

      if (cursorEvent.length > 0) {
        conditions.push(lt(events.createdAt, cursorEvent[0].createdAt));
      }
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(desc(events.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    if (hasMore) results.pop();

    return {
      events: results,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    };
  }

  async findById(id: string, userId: string, userRole: string) {
    const event = await this.db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (event.length === 0) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // super_admin can see any event
    if (userRole !== 'super_admin') {
      const hasAccess =
        event[0].organizerId === userId ||
        (await this.isMember(id, userId));

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this event',
        );
      }
    }

    return event[0];
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdateEventDto,
  ) {
    const event = await this.findById(id, userId, userRole);

    if (event.status !== 'draft' && event.status !== 'setup') {
      throw new BadRequestException(
        'Event can only be updated in draft or setup status',
      );
    }

    const isAdmin = await this.isEventAdmin(id, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only the organizer or super_admin can update this event',
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.tokenCurrencyRate !== undefined)
      updateData.tokenCurrencyRate = String(dto.tokenCurrencyRate);
    if (dto.maxTransactionAmount !== undefined)
      updateData.maxTransactionAmount = dto.maxTransactionAmount;
    if (dto.maxOfflineSpend !== undefined)
      updateData.maxOfflineSpend = dto.maxOfflineSpend;
    if (dto.defaultCommissionRate !== undefined)
      updateData.defaultCommissionRate = String(dto.defaultCommissionRate);
    if (dto.startDate !== undefined) updateData.startDate = dto.startDate;
    if (dto.endDate !== undefined) updateData.endDate = dto.endDate;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.location !== undefined) updateData.location = dto.location;

    const result = await this.db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    return result[0];
  }

  async updateStatus(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdateEventStatusDto,
  ) {
    const event = await this.findById(id, userId, userRole);

    const isAdmin = await this.isEventAdmin(id, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only the organizer or super_admin can change event status',
      );
    }

    const currentStatus = event.status;
    const targetStatus = dto.status;

    // Check if transition is valid
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${currentStatus}" to "${targetStatus}". Allowed transitions: ${allowed.join(', ') || 'none'}`,
      );
    }

    // Validate requirements for specific transitions
    if (currentStatus === 'draft' && targetStatus === 'setup') {
      // Must have name, dates, and token rate (basic validation)
      if (!event.name || !event.startDate || !event.endDate || !event.tokenCurrencyRate) {
        throw new BadRequestException(
          'Event must have a name, start date, end date, and token currency rate before moving to setup',
        );
      }
    }

    if (currentStatus === 'setup' && targetStatus === 'active') {
      // Must have at least 1 approved vendor
      const vendorCount = await this.db
        .select({ total: count() })
        .from(vendors)
        .where(
          and(
            eq(vendors.eventId, id),
            eq(vendors.status, 'approved'),
          ),
        );

      if (!vendorCount[0] || vendorCount[0].total === 0) {
        throw new BadRequestException(
          'Event must have at least one approved vendor before going active',
        );
      }
    }

    const result = await this.db
      .update(events)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    return result[0];
  }

  async delete(id: string, userId: string, userRole: string) {
    const event = await this.findById(id, userId, userRole);

    if (event.status !== 'draft') {
      throw new BadRequestException(
        'Only events in draft status can be deleted',
      );
    }

    const isAdmin = await this.isEventAdmin(id, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only the organizer or super_admin can delete this event',
      );
    }

    await this.db.delete(events).where(eq(events.id, id));

    return { message: 'Event deleted successfully' };
  }

  async addMember(
    eventId: string,
    userId: string,
    userRole: string,
    dto: AddMemberDto,
  ) {
    // Verify the event exists and the current user has access
    await this.findById(eventId, userId, userRole);

    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only the organizer or super_admin can add members',
      );
    }

    // Check target user exists
    const targetUser = await this.db
      .select()
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);

    if (targetUser.length === 0) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Check if already a member
    const existing = await this.db
      .select()
      .from(eventMembers)
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, dto.userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestException('User is already a member of this event');
    }

    const result = await this.db
      .insert(eventMembers)
      .values({
        eventId,
        userId: dto.userId,
        role: dto.role,
        invitedBy: userId,
      })
      .returning();

    return result[0];
  }

  async getMembers(eventId: string) {
    const results = await this.db
      .select({
        id: eventMembers.id,
        eventId: eventMembers.eventId,
        userId: eventMembers.userId,
        role: eventMembers.role,
        invitedBy: eventMembers.invitedBy,
        createdAt: eventMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(eventMembers)
      .innerJoin(users, eq(eventMembers.userId, users.id))
      .where(eq(eventMembers.eventId, eventId));

    return results;
  }

  async removeMember(
    eventId: string,
    memberId: string,
    userId: string,
    userRole: string,
  ) {
    await this.findById(eventId, userId, userRole);

    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only the organizer or super_admin can remove members',
      );
    }

    // Find the member record
    const member = await this.db
      .select()
      .from(eventMembers)
      .where(
        and(
          eq(eventMembers.id, memberId),
          eq(eventMembers.eventId, eventId),
        ),
      )
      .limit(1);

    if (member.length === 0) {
      throw new NotFoundException('Member not found in this event');
    }

    // Get the event to check if removing the organizer
    const event = await this.db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (event.length > 0 && member[0].userId === event[0].organizerId) {
      throw new BadRequestException('Cannot remove the event organizer');
    }

    await this.db
      .delete(eventMembers)
      .where(eq(eventMembers.id, memberId));

    return { message: 'Member removed successfully' };
  }

  async isEventAdmin(
    eventId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    if (userRole === 'super_admin') return true;

    // Check if user is the organizer
    const event = await this.db
      .select({ organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (event.length > 0 && event[0].organizerId === userId) return true;

    // Check if user is a member with organizer or admin role
    const membership = await this.db
      .select()
      .from(eventMembers)
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, userId),
        ),
      )
      .limit(1);

    if (
      membership.length > 0 &&
      (membership[0].role === 'organizer' || membership[0].role === 'admin')
    ) {
      return true;
    }

    return false;
  }

  private async isMember(
    eventId: string,
    userId: string,
  ): Promise<boolean> {
    const membership = await this.db
      .select()
      .from(eventMembers)
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, userId),
        ),
      )
      .limit(1);

    return membership.length > 0;
  }
}
