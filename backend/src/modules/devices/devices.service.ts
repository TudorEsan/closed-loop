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
  devices,
  deviceOperators,
  deviceRegistrationTokens,
  vendors,
  vendorMembers,
  events,
  eventMembers,
  users,
} from '@common/database/schemas';
import { eq, and, or, ilike, desc, lt, inArray, type SQL } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { RejectDeviceDto } from './dto/approve-device.dto';
import { AssignOperatorDto } from './dto/assign-operator.dto';
import { CreateRegistrationTokenDto } from './dto/create-registration-token.dto';
import { DeviceQueryDto } from './dto/device-query.dto';

@Injectable()
export class DevicesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  // ---- Registration Tokens ----

  async createRegistrationToken(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
    dto: CreateRegistrationTokenDto,
  ) {
    const canManage = await this.canManageVendorDevices(
      eventId,
      vendorId,
      userId,
      userRole,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'Only admins or vendor owners/managers can create registration tokens',
      );
    }

    // Verify vendor exists and belongs to event
    const vendor = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (vendor.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    if (vendor[0].status !== 'approved') {
      throw new BadRequestException(
        'Can only create registration tokens for approved vendors',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresInHours = dto.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const result = await this.db
      .insert(deviceRegistrationTokens)
      .values({
        vendorId,
        token,
        maxUses: dto.maxUses ?? 1,
        createdBy: userId,
        expiresAt,
      })
      .returning();

    return result[0];
  }

  // ---- Device Registration ----

  async registerDevice(
    eventId: string,
    vendorId: string,
    dto: RegisterDeviceDto,
    ipAddress: string,
  ) {
    // Validate the registration token
    const tokenRecord = await this.db
      .select()
      .from(deviceRegistrationTokens)
      .where(eq(deviceRegistrationTokens.token, dto.registrationToken))
      .limit(1);

    if (tokenRecord.length === 0) {
      throw new BadRequestException('Invalid registration token');
    }

    const regToken = tokenRecord[0];

    if (regToken.vendorId !== vendorId) {
      throw new BadRequestException(
        'Registration token does not belong to this vendor',
      );
    }

    if (new Date() > regToken.expiresAt) {
      throw new BadRequestException('Registration token has expired');
    }

    if (regToken.usedCount >= regToken.maxUses) {
      throw new BadRequestException(
        'Registration token has reached its usage limit',
      );
    }

    // Verify vendor exists, is approved, and belongs to event
    const vendor = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), eq(vendors.eventId, eventId)))
      .limit(1);

    if (vendor.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    if (vendor[0].status !== 'approved') {
      throw new BadRequestException('Vendor is not approved');
    }

    // Check if device identifier is already registered
    const existingDevice = await this.db
      .select()
      .from(devices)
      .where(eq(devices.deviceIdentifier, dto.deviceIdentifier))
      .limit(1);

    if (existingDevice.length > 0) {
      throw new ConflictException(
        'A device with this identifier is already registered',
      );
    }

    // Create the device record
    const result = await this.db
      .insert(devices)
      .values({
        vendorId,
        deviceIdentifier: dto.deviceIdentifier,
        deviceName: dto.deviceName,
        deviceModel: dto.deviceModel,
        osName: dto.osName,
        osVersion: dto.osVersion,
        appVersion: dto.appVersion,
        screenWidth: dto.screenWidth,
        screenHeight: dto.screenHeight,
        registrationLatitude: dto.latitude?.toString(),
        registrationLongitude: dto.longitude?.toString(),
        registrationIpAddress: ipAddress,
        deviceFingerprint: dto.deviceFingerprint,
        registrationTokenId: regToken.id,
        status: 'pending_approval',
      })
      .returning();

    // Increment token usage
    await this.db
      .update(deviceRegistrationTokens)
      .set({ usedCount: regToken.usedCount + 1 })
      .where(eq(deviceRegistrationTokens.id, regToken.id));

    return result[0];
  }

  // ---- Device Approval ----

  async approveDevice(
    eventId: string,
    deviceId: string,
    userId: string,
    userRole: string,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can approve devices');
    }

    const device = await this.getDeviceForEvent(eventId, deviceId);

    if (device.status !== 'pending_approval') {
      throw new BadRequestException(
        `Device is already in "${device.status}" status`,
      );
    }

    // Generate key provisioning data
    const keyDerivationSalt = randomBytes(32).toString('hex');

    const result = await this.db
      .update(devices)
      .set({
        status: 'active',
        approvedBy: userId,
        approvedAt: new Date(),
        keyProvisionedAt: new Date(),
        keyVersion: 1,
        keyDerivationSalt,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, deviceId))
      .returning();

    return result[0];
  }

  async rejectDevice(
    eventId: string,
    deviceId: string,
    userId: string,
    userRole: string,
    dto: RejectDeviceDto,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can reject devices');
    }

    const device = await this.getDeviceForEvent(eventId, deviceId);

    if (device.status !== 'pending_approval') {
      throw new BadRequestException(
        `Can only reject devices that are pending approval`,
      );
    }

    const result = await this.db
      .update(devices)
      .set({
        status: 'blocked',
        rejectionReason: dto.rejectionReason,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, deviceId))
      .returning();

    return result[0];
  }

  async blockDevice(
    eventId: string,
    deviceId: string,
    userId: string,
    userRole: string,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can block devices');
    }

    const device = await this.getDeviceForEvent(eventId, deviceId);

    if (device.status === 'blocked') {
      throw new BadRequestException('Device is already blocked');
    }

    const result = await this.db
      .update(devices)
      .set({ status: 'blocked', updatedAt: new Date() })
      .where(eq(devices.id, deviceId))
      .returning();

    return result[0];
  }

  async unblockDevice(
    eventId: string,
    deviceId: string,
    userId: string,
    userRole: string,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can unblock devices');
    }

    const device = await this.getDeviceForEvent(eventId, deviceId);

    if (device.status !== 'blocked') {
      throw new BadRequestException('Device is not blocked');
    }

    const result = await this.db
      .update(devices)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(devices.id, deviceId))
      .returning();

    return result[0];
  }

  // ---- Device Queries ----

  async findAllByEvent(
    eventId: string,
    userId: string,
    userRole: string,
    query: DeviceQueryDto,
  ) {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can list all event devices');
    }

    const { status, search, limit = 20, cursor } = query;

    // Get all vendors for this event
    const eventVendors = await this.db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.eventId, eventId));

    const vendorIds = eventVendors.map((v) => v.id);
    if (vendorIds.length === 0) {
      return { devices: [], nextCursor: null };
    }

    const conditions: SQL<unknown>[] = [];

    // Filter devices by vendors that belong to this event
    if (vendorIds.length === 1) {
      conditions.push(eq(devices.vendorId, vendorIds[0]));
    } else {
      conditions.push(inArray(devices.vendorId, vendorIds));
    }

    if (status) {
      conditions.push(eq(devices.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(devices.deviceName, `%${search}%`),
          ilike(devices.deviceModel, `%${search}%`),
        )!,
      );
    }

    if (cursor) {
      const cursorDevice = await this.db
        .select({ createdAt: devices.createdAt })
        .from(devices)
        .where(eq(devices.id, cursor))
        .limit(1);

      if (cursorDevice.length > 0) {
        conditions.push(lt(devices.createdAt, cursorDevice[0].createdAt));
      }
    }

    const whereClause = and(...conditions);

    const results = await this.db
      .select()
      .from(devices)
      .where(whereClause)
      .orderBy(desc(devices.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    if (hasMore) results.pop();

    return {
      devices: results,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    };
  }

  async findByVendor(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
    query: DeviceQueryDto,
  ) {
    const canView = await this.canManageVendorDevices(
      eventId,
      vendorId,
      userId,
      userRole,
    );
    if (!canView) {
      throw new ForbiddenException(
        "You do not have access to this vendor's devices",
      );
    }

    const { status, limit = 20, cursor } = query;

    const conditions: SQL<unknown>[] = [eq(devices.vendorId, vendorId)];

    if (status) {
      conditions.push(eq(devices.status, status));
    }

    if (cursor) {
      const cursorDevice = await this.db
        .select({ createdAt: devices.createdAt })
        .from(devices)
        .where(eq(devices.id, cursor))
        .limit(1);

      if (cursorDevice.length > 0) {
        conditions.push(lt(devices.createdAt, cursorDevice[0].createdAt));
      }
    }

    const results = await this.db
      .select()
      .from(devices)
      .where(and(...conditions))
      .orderBy(desc(devices.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    if (hasMore) results.pop();

    return {
      devices: results,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    };
  }

  async findById(
    eventId: string,
    deviceId: string,
    userId: string,
    userRole: string,
  ) {
    const device = await this.getDeviceForEvent(eventId, deviceId);

    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (!isAdmin) {
      const canView = await this.canManageVendorDevices(
        eventId,
        device.vendorId,
        userId,
        userRole,
      );
      if (!canView) {
        throw new ForbiddenException('You do not have access to this device');
      }
    }

    return device;
  }

  // ---- Device Operators ----

  async assignOperator(
    eventId: string,
    deviceId: string,
    userId: string,
    userRole: string,
    dto: AssignOperatorDto,
  ) {
    const device = await this.getDeviceForEvent(eventId, deviceId);

    const canManage = await this.canManageVendorDevices(
      eventId,
      device.vendorId,
      userId,
      userRole,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'Only admins or vendor owners/managers can assign operators',
      );
    }

    // Verify the target user exists
    const targetUser = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);

    if (targetUser.length === 0) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Check if user is a vendor member
    const membership = await this.db
      .select()
      .from(vendorMembers)
      .where(
        and(
          eq(vendorMembers.vendorId, device.vendorId),
          eq(vendorMembers.userId, dto.userId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      throw new BadRequestException(
        'User must be a member of the vendor to be assigned as device operator',
      );
    }

    // Check if already assigned
    const existing = await this.db
      .select()
      .from(deviceOperators)
      .where(
        and(
          eq(deviceOperators.deviceId, deviceId),
          eq(deviceOperators.userId, dto.userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].status === 'active') {
        throw new ConflictException(
          'User is already an active operator of this device',
        );
      }
      // Reactivate revoked operator
      const result = await this.db
        .update(deviceOperators)
        .set({
          status: 'active',
          assignedBy: userId,
          revokedBy: null,
          revokedAt: null,
        })
        .where(eq(deviceOperators.id, existing[0].id))
        .returning();
      return result[0];
    }

    const result = await this.db
      .insert(deviceOperators)
      .values({
        deviceId,
        userId: dto.userId,
        assignedBy: userId,
      })
      .returning();

    return result[0];
  }

  async findOperators(
    eventId: string,
    deviceId: string,
    userId: string,
    userRole: string,
  ) {
    const device = await this.getDeviceForEvent(eventId, deviceId);

    const canView = await this.canManageVendorDevices(
      eventId,
      device.vendorId,
      userId,
      userRole,
    );
    if (!canView) {
      throw new ForbiddenException('You do not have access to this device');
    }

    return this.db
      .select({
        id: deviceOperators.id,
        userId: deviceOperators.userId,
        status: deviceOperators.status,
        assignedBy: deviceOperators.assignedBy,
        createdAt: deviceOperators.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(deviceOperators)
      .innerJoin(users, eq(users.id, deviceOperators.userId))
      .where(
        and(
          eq(deviceOperators.deviceId, deviceId),
          eq(deviceOperators.status, 'active'),
        ),
      );
  }

  async revokeOperator(
    eventId: string,
    deviceId: string,
    operatorId: string,
    userId: string,
    userRole: string,
  ) {
    const device = await this.getDeviceForEvent(eventId, deviceId);

    const canManage = await this.canManageVendorDevices(
      eventId,
      device.vendorId,
      userId,
      userRole,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'Only admins or vendor owners/managers can revoke operators',
      );
    }

    const operator = await this.db
      .select()
      .from(deviceOperators)
      .where(
        and(
          eq(deviceOperators.id, operatorId),
          eq(deviceOperators.deviceId, deviceId),
        ),
      )
      .limit(1);

    if (operator.length === 0) {
      throw new NotFoundException('Operator assignment not found');
    }

    if (operator[0].status === 'revoked') {
      throw new BadRequestException('Operator is already revoked');
    }

    const result = await this.db
      .update(deviceOperators)
      .set({
        status: 'revoked',
        revokedBy: userId,
        revokedAt: new Date(),
      })
      .where(eq(deviceOperators.id, operatorId))
      .returning();

    return result[0];
  }

  // ---- Helpers ----

  private async getDeviceForEvent(eventId: string, deviceId: string) {
    const device = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    if (device.length === 0) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    // Verify the device's vendor belongs to this event
    const vendor = await this.db
      .select({ eventId: vendors.eventId })
      .from(vendors)
      .where(eq(vendors.id, device[0].vendorId))
      .limit(1);

    if (vendor.length === 0 || vendor[0].eventId !== eventId) {
      throw new NotFoundException(
        `Device with ID ${deviceId} not found in this event`,
      );
    }

    return device[0];
  }

  private async canManageVendorDevices(
    eventId: string,
    vendorId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    const isAdmin = await this.isEventAdmin(eventId, userId, userRole);
    if (isAdmin) return true;

    // Check if user is an owner or manager of the vendor
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

  private async isEventAdmin(
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
