import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  vendors,
  events,
  eventMembers,
  transactions,
} from '@common/database/schemas';
import { eq, and, or, ilike, desc, lt, count, type SQL } from 'drizzle-orm';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorStatusDto } from './dto/update-vendor-status.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';

@Injectable()
export class VendorsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(eventId: string, userId: string, dto: CreateVendorDto) {
    // Check event exists and is in an acceptable status
    const event = await this.db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (event.length === 0) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const allowedStatuses = ['draft', 'setup', 'active'];
    if (!allowedStatuses.includes(event[0].status)) {
      throw new BadRequestException(
        `Cannot add vendors to an event with status "${event[0].status}"`,
      );
    }

    // Check user does not already have a vendor record for this event
    const existing = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.userId, userId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        'User already has a vendor record for this event',
      );
    }

    const result = await this.db
      .insert(vendors)
      .values({
        userId,
        eventId,
        businessName: dto.businessName,
        contactPerson: dto.contactPerson,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        productType: dto.productType,
        description: dto.description,
        status: 'pending',
      })
      .returning();

    return result[0];
  }

  async findAllByEvent(
    eventId: string,
    userId: string,
    userRole: string,
    query: VendorQueryDto,
  ) {
    const { status, search, limit = 20, cursor } = query;

    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);

    const conditions: SQL<unknown>[] = [eq(vendors.eventId, eventId)];

    // Non-admin users (vendors) can only see their own record
    if (!isAdmin) {
      conditions.push(eq(vendors.userId, userId));
    }

    if (status) {
      conditions.push(eq(vendors.status, status));
    }

    if (search) {
      conditions.push(ilike(vendors.businessName, `%${search}%`));
    }

    if (cursor) {
      const cursorVendor = await this.db
        .select({ createdAt: vendors.createdAt })
        .from(vendors)
        .where(eq(vendors.id, cursor))
        .limit(1);

      if (cursorVendor.length > 0) {
        conditions.push(lt(vendors.createdAt, cursorVendor[0].createdAt));
      }
    }

    const whereClause = and(...conditions);

    const results = await this.db
      .select()
      .from(vendors)
      .where(whereClause)
      .orderBy(desc(vendors.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    if (hasMore) results.pop();

    return {
      vendors: results,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    };
  }

  async findById(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
  ) {
    const vendor = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (vendor.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);

    // Non-admin users can only view their own vendor record
    if (!isAdmin && vendor[0].userId !== userId) {
      throw new ForbiddenException('You can only view your own vendor record');
    }

    return vendor[0];
  }

  async update(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
    dto: UpdateVendorDto,
  ) {
    const vendor = await this.findById(eventId, vendorId, userId, userRole);

    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);

    // Vendors can only update their own record
    if (!isAdmin && vendor.userId !== userId) {
      throw new ForbiddenException('You can only update your own vendor record');
    }

    const result = await this.db
      .update(vendors)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning();

    return result[0];
  }

  async updateStatus(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
    dto: UpdateVendorStatusDto,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only admins can change vendor status',
      );
    }

    const vendor = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (vendor.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    // Validate status transitions
    const currentStatus = vendor[0].status;
    if (currentStatus === dto.status) {
      throw new BadRequestException(
        `Vendor is already in "${currentStatus}" status`,
      );
    }

    const updateData: Record<string, unknown> = {
      status: dto.status,
      updatedAt: new Date(),
    };

    // Set approval fields when approving
    if (dto.status === 'approved') {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }

    const result = await this.db
      .update(vendors)
      .set(updateData)
      .where(eq(vendors.id, vendorId))
      .returning();

    return result[0];
  }

  async updateCommission(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
    dto: UpdateCommissionDto,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only admins can set commission rates',
      );
    }

    const vendor = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (vendor.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    const result = await this.db
      .update(vendors)
      .set({
        commissionRate: dto.commissionRate.toString(),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId))
      .returning();

    return result[0];
  }

  async remove(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can remove vendors');
    }

    const vendor = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (vendor.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    // Check if vendor has any transactions
    const txCount = await this.db
      .select({ value: count() })
      .from(transactions)
      .where(eq(transactions.vendorId, vendorId));

    if (txCount[0].value > 0) {
      throw new BadRequestException(
        'Cannot delete vendor with existing transactions',
      );
    }

    await this.db.delete(vendors).where(eq(vendors.id, vendorId));

    return { deleted: true };
  }

  async isEventAdmin(
    eventId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    if (userRole === 'super_admin') return true;

    // Check if user is the event organizer
    const event = await this.db
      .select({ organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (event.length > 0 && event[0].organizerId === userId) return true;

    // Check if user is an event member with organizer or admin role
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
}
