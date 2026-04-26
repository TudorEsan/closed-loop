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
  vendorMembers,
  events,
  eventMembers,
  transactions,
  users,
} from '@common/database/schemas';
import {
  eq,
  and,
  or,
  ilike,
  desc,
  lt,
  inArray,
  count,
  type SQL,
} from 'drizzle-orm';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorStatusDto } from './dto/update-vendor-status.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';

@Injectable()
export class VendorsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(
    eventId: string,
    userId: string,
    userRole: string,
    dto: CreateVendorDto,
  ) {
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

    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);

    let ownerUserId = userId;

    if (isAdmin && dto.targetUserId) {
      const targetUser = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, dto.targetUserId))
        .limit(1);

      if (targetUser.length === 0) {
        throw new NotFoundException(
          `User with ID ${dto.targetUserId} not found`,
        );
      }

      ownerUserId = dto.targetUserId;
    } else if (isAdmin && dto.contactEmail) {
      const normalizedEmail = dto.contactEmail.toLowerCase().trim();
      const existingByEmail = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingByEmail.length > 0) {
        ownerUserId = existingByEmail[0].id;
      } else {
        const namePart = normalizedEmail.split('@')[0] || 'New vendor';
        const createdUser = await this.db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            email: normalizedEmail,
            emailVerified: false,
            name: namePart,
            role: 'user',
            isActive: true,
          })
          .returning();

        ownerUserId = createdUser[0].id;
      }
    }

    const existing = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.userId, ownerUserId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        'User already has a vendor record for this event',
      );
    }

    const status = isAdmin ? 'approved' : 'pending';
    const approvalFields = isAdmin
      ? { approvedBy: userId, approvedAt: new Date() }
      : {};

    const result = await this.db
      .insert(vendors)
      .values({
        userId: ownerUserId,
        eventId,
        businessName: dto.businessName,
        contactPerson: dto.contactPerson,
        contactEmail: dto.contactEmail,
        productType: dto.productType,
        description: dto.description,
        status,
        ...approvalFields,
      })
      .returning();

    const vendor = result[0];

    await this.db.insert(vendorMembers).values({
      vendorId: vendor.id,
      userId: ownerUserId,
      role: 'owner',
      invitedBy: userId,
    });

    return vendor;
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

    if (!isAdmin) {
      const memberships = await this.db
        .select({ vendorId: vendorMembers.vendorId })
        .from(vendorMembers)
        .where(eq(vendorMembers.userId, userId));

      const vendorIds = memberships.map((m) => m.vendorId);

      if (vendorIds.length === 0) {
        conditions.push(eq(vendors.userId, userId));
      } else {
        conditions.push(
          or(eq(vendors.userId, userId), inArray(vendors.id, vendorIds))!,
        );
      }
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

    if (!isAdmin && vendor.userId !== userId) {
      throw new ForbiddenException(
        'You can only update your own vendor record',
      );
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
      throw new ForbiddenException('Only admins can change vendor status');
    }

    const vendor = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (vendor.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

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
      throw new ForbiddenException('Only admins can set commission rates');
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

  // ---- Vendor Members ----

  async findMembers(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
  ) {
    const canView = await this.canManageVendor(
      eventId,
      vendorId,
      userId,
      userRole,
    );
    if (!canView) {
      throw new ForbiddenException('You do not have access to this vendor');
    }

    return this.db
      .select({
        id: vendorMembers.id,
        userId: vendorMembers.userId,
        role: vendorMembers.role,
        invitedBy: vendorMembers.invitedBy,
        createdAt: vendorMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(vendorMembers)
      .innerJoin(users, eq(users.id, vendorMembers.userId))
      .where(eq(vendorMembers.vendorId, vendorId));
  }

  async addMember(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
    dto: { userId?: string; email?: string; role: 'manager' | 'cashier' },
  ) {
    const canManage = await this.canManageVendor(
      eventId,
      vendorId,
      userId,
      userRole,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'Only vendor owners or admins can add members',
      );
    }

    if (!dto.userId && !dto.email) {
      throw new BadRequestException('Either userId or email must be provided');
    }

    let targetUserId: string;

    if (dto.userId) {
      const existingUser = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, dto.userId))
        .limit(1);

      if (existingUser.length === 0) {
        throw new NotFoundException(`User with ID ${dto.userId} not found`);
      }

      targetUserId = existingUser[0].id;
    } else {
      const normalizedEmail = dto.email!.toLowerCase().trim();
      const existingByEmail = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingByEmail.length > 0) {
        targetUserId = existingByEmail[0].id;
      } else {
        const namePart = normalizedEmail.split('@')[0] || 'New member';
        const createdUser = await this.db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            email: normalizedEmail,
            emailVerified: false,
            name: namePart,
            role: 'user',
            isActive: true,
          })
          .returning();

        targetUserId = createdUser[0].id;
      }
    }

    const existing = await this.db
      .select({ id: vendorMembers.id })
      .from(vendorMembers)
      .where(
        and(
          eq(vendorMembers.vendorId, vendorId),
          eq(vendorMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        'User is already a member of this vendor',
      );
    }

    const inserted = await this.db
      .insert(vendorMembers)
      .values({
        vendorId,
        userId: targetUserId,
        role: dto.role,
        invitedBy: userId,
      })
      .returning();

    return inserted[0];
  }

  async updateMemberRole(
    eventId: string,
    vendorId: string,
    memberId: string,
    userId: string,
    userRole: string,
    newRole: 'manager' | 'cashier',
  ) {
    const canManage = await this.canManageVendor(
      eventId,
      vendorId,
      userId,
      userRole,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'Only vendor owners or admins can change member roles',
      );
    }

    const member = await this.db
      .select()
      .from(vendorMembers)
      .where(
        and(
          eq(vendorMembers.id, memberId),
          eq(vendorMembers.vendorId, vendorId),
        ),
      )
      .limit(1);

    if (member.length === 0) {
      throw new NotFoundException('Member not found');
    }

    if (member[0].role === 'owner') {
      throw new BadRequestException(
        'Cannot change the role of the vendor owner',
      );
    }

    const result = await this.db
      .update(vendorMembers)
      .set({ role: newRole })
      .where(eq(vendorMembers.id, memberId))
      .returning();

    return result[0];
  }

  async removeMember(
    eventId: string,
    vendorId: string,
    memberId: string,
    userId: string,
    userRole: string,
  ) {
    const canManage = await this.canManageVendor(
      eventId,
      vendorId,
      userId,
      userRole,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'Only vendor owners or admins can remove members',
      );
    }

    const member = await this.db
      .select()
      .from(vendorMembers)
      .where(
        and(
          eq(vendorMembers.id, memberId),
          eq(vendorMembers.vendorId, vendorId),
        ),
      )
      .limit(1);

    if (member.length === 0) {
      throw new NotFoundException('Member not found');
    }

    if (member[0].role === 'owner') {
      throw new BadRequestException('Cannot remove the vendor owner');
    }

    await this.db.delete(vendorMembers).where(eq(vendorMembers.id, memberId));

    return { deleted: true };
  }

  // ---- Authorization helpers ----

  async canManageVendor(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (isAdmin) return true;

    const membership = await this.db
      .select()
      .from(vendorMembers)
      .where(
        and(
          eq(vendorMembers.vendorId, vendorId),
          eq(vendorMembers.userId, userId),
          or(
            eq(vendorMembers.role, 'owner'),
            eq(vendorMembers.role, 'manager'),
          ),
        ),
      )
      .limit(1);

    return membership.length > 0;
  }

  async isEventAdmin(
    eventId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    if (userRole === 'super_admin') return true;

    const event = await this.db
      .select({ organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (event.length > 0 && event[0].organizerId === userId) return true;

    const membership = await this.db
      .select()
      .from(eventMembers)
      .where(
        and(
          eq(eventMembers.eventId, eventId),
          eq(eventMembers.userId, userId),
          eq(eventMembers.role, 'admin'),
        ),
      )
      .limit(1);

    return membership.length > 0;
  }
}
