import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  eventMembers,
  events,
  vendorMembers,
  vendors,
} from '@common/database/schemas';

export type EventRole = 'admin' | 'operator';
export type VendorRole = 'owner' | 'manager' | 'cashier';

const EVENT_ROLE_RANK: Record<EventRole, number> = {
  operator: 1,
  admin: 2,
};

const VENDOR_ROLE_RANK: Record<VendorRole, number> = {
  cashier: 1,
  manager: 2,
  owner: 3,
};

export type EventScope = {
  event: typeof events.$inferSelect;
  // 'admin' for super_admin, organizers, and event_members.role='admin'.
  // 'operator' for event_members.role='operator'.
  role: EventRole;
};

export type VendorScope = {
  vendor: typeof vendors.$inferSelect;
  role: VendorRole;
};

@Injectable()
export class ScopeService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  // Returns the caller's effective role at the event, or throws.
  // `min` defaults to 'operator' (any membership), pass 'admin' for write actions.
  async requireEventRole(
    userId: string,
    userRole: string,
    eventId: string,
    min: EventRole = 'operator',
  ): Promise<EventScope> {
    const event = await this.requireEvent(eventId);

    if (userRole === 'super_admin') {
      return { event, role: 'admin' };
    }

    if (event.organizerId === userId) {
      return { event, role: 'admin' };
    }

    const rows = await this.db
      .select({ role: eventMembers.role })
      .from(eventMembers)
      .where(
        and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)),
      )
      .limit(1);

    const role = rows[0]?.role as EventRole | undefined;
    if (!role) {
      throw new ForbiddenException('You do not have access to this event');
    }

    if (EVENT_ROLE_RANK[role] < EVENT_ROLE_RANK[min]) {
      throw new ForbiddenException(
        `This action requires the "${min}" role at this event`,
      );
    }

    return { event, role };
  }

  // Membership at the vendor (or admin at the parent event, or super_admin).
  // `min` defaults to 'cashier' (any membership), pass 'manager' / 'owner' for
  // sensitive operations.
  async requireVendorRole(
    userId: string,
    userRole: string,
    vendorId: string,
    min: VendorRole = 'cashier',
  ): Promise<VendorScope> {
    const vendor = await this.requireVendor(vendorId);

    if (userRole === 'super_admin') {
      return { vendor, role: 'owner' };
    }

    // Event admins can manage vendors at their event.
    const event = await this.db
      .select({ organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, vendor.eventId))
      .limit(1);

    if (event.length > 0 && event[0].organizerId === userId) {
      return { vendor, role: 'owner' };
    }

    const eventAdmin = await this.db
      .select({ id: eventMembers.id })
      .from(eventMembers)
      .where(
        and(
          eq(eventMembers.eventId, vendor.eventId),
          eq(eventMembers.userId, userId),
          eq(eventMembers.role, 'admin'),
        ),
      )
      .limit(1);

    if (eventAdmin.length > 0) {
      return { vendor, role: 'owner' };
    }

    const rows = await this.db
      .select({ role: vendorMembers.role })
      .from(vendorMembers)
      .where(
        and(
          eq(vendorMembers.vendorId, vendorId),
          eq(vendorMembers.userId, userId),
        ),
      )
      .limit(1);

    const role = rows[0]?.role as VendorRole | undefined;
    if (!role) {
      throw new ForbiddenException('You do not have access to this vendor');
    }

    if (VENDOR_ROLE_RANK[role] < VENDOR_ROLE_RANK[min]) {
      throw new ForbiddenException(
        `This action requires the "${min}" role at this vendor`,
      );
    }

    return { vendor, role };
  }

  // Read-level access: event admin/operator OR a vendor member of any vendor
  // at the event. Used by sync bundle, bracelet lookup by UID, etc.
  async requireEventOrVendorAccess(
    userId: string,
    userRole: string,
    eventId: string,
  ): Promise<typeof events.$inferSelect> {
    const event = await this.requireEvent(eventId);

    if (userRole === 'super_admin' || event.organizerId === userId) {
      return event;
    }

    const eventMember = await this.db
      .select({ id: eventMembers.id })
      .from(eventMembers)
      .where(
        and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)),
      )
      .limit(1);
    if (eventMember.length > 0) return event;

    const vendorMember = await this.db
      .select({ id: vendorMembers.id })
      .from(vendorMembers)
      .innerJoin(vendors, eq(vendors.id, vendorMembers.vendorId))
      .where(
        and(eq(vendors.eventId, eventId), eq(vendorMembers.userId, userId)),
      )
      .limit(1);
    if (vendorMember.length > 0) return event;

    throw new ForbiddenException('You do not have access to this event');
  }

  private async requireEvent(eventId: string) {
    const rows = await this.db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }
    return rows[0];
  }

  private async requireVendor(vendorId: string) {
    const rows = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }
    return rows[0];
  }
}
