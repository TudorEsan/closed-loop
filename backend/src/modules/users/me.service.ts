import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '@common/database/drizzle.module';
import { DrizzleClient } from '@common/database/drizzle.client';
import {
  eventMembers,
  events,
  vendorMembers,
  vendors,
} from '@common/database/schemas';

export type EventMembershipRow = {
  eventId: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string | null;
  role: 'admin' | 'operator';
  isOrganizer: boolean;
};

export type VendorMembershipRow = {
  vendorId: string;
  businessName: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  eventId: string;
  eventName: string;
  role: 'owner' | 'manager' | 'cashier';
};

export type MembershipsResponse = {
  isSuperAdmin: boolean;
  events: EventMembershipRow[];
  vendors: VendorMembershipRow[];
};

@Injectable()
export class MeService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async getMemberships(
    userId: string,
    userRole: string,
  ): Promise<MembershipsResponse> {
    const isSuperAdmin = userRole === 'super_admin';

    const memberRows = await this.db
      .select({
        eventId: events.id,
        name: events.name,
        status: events.status,
        startDate: events.startDate,
        endDate: events.endDate,
        location: events.location,
        role: eventMembers.role,
        organizerId: events.organizerId,
      })
      .from(eventMembers)
      .innerJoin(events, eq(events.id, eventMembers.eventId))
      .where(eq(eventMembers.userId, userId))
      .orderBy(desc(events.startDate));

    const organizerRows = await this.db
      .select({
        eventId: events.id,
        name: events.name,
        status: events.status,
        startDate: events.startDate,
        endDate: events.endDate,
        location: events.location,
      })
      .from(events)
      .where(eq(events.organizerId, userId))
      .orderBy(desc(events.startDate));

    const eventMap = new Map<string, EventMembershipRow>();
    for (const row of memberRows) {
      eventMap.set(row.eventId, {
        eventId: row.eventId,
        name: row.name,
        status: row.status,
        startDate: row.startDate,
        endDate: row.endDate,
        location: row.location,
        role: row.organizerId === userId ? 'admin' : row.role,
        isOrganizer: row.organizerId === userId,
      });
    }
    for (const row of organizerRows) {
      const existing = eventMap.get(row.eventId);
      if (existing) {
        existing.role = 'admin';
        existing.isOrganizer = true;
      } else {
        eventMap.set(row.eventId, {
          eventId: row.eventId,
          name: row.name,
          status: row.status,
          startDate: row.startDate,
          endDate: row.endDate,
          location: row.location,
          role: 'admin',
          isOrganizer: true,
        });
      }
    }

    const eventList = Array.from(eventMap.values()).sort((a, b) =>
      a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0,
    );

    const vendorRows = await this.db
      .select({
        vendorId: vendors.id,
        businessName: vendors.businessName,
        status: vendors.status,
        eventId: vendors.eventId,
        eventName: events.name,
        role: vendorMembers.role,
      })
      .from(vendorMembers)
      .innerJoin(vendors, eq(vendors.id, vendorMembers.vendorId))
      .innerJoin(events, eq(events.id, vendors.eventId))
      .where(
        and(
          eq(vendorMembers.userId, userId),
          inArray(vendors.status, ['approved', 'pending', 'suspended']),
        ),
      )
      .orderBy(desc(events.startDate));

    return {
      isSuperAdmin,
      events: eventList,
      vendors: vendorRows.map((row) => ({
        vendorId: row.vendorId,
        businessName: row.businessName,
        status: row.status,
        eventId: row.eventId,
        eventName: row.eventName,
        role: row.role,
      })),
    };
  }
}
