import {
  pgTable,
  text,
  varchar,
  timestamp,
  decimal,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { vendorStatusEnum } from './enums';
import { users } from './auth';
import { events } from './events';

export const vendors = pgTable(
  'vendors',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    contactPerson: varchar('contact_person', { length: 255 }).notNull(),
    contactEmail: varchar('contact_email', { length: 255 }),
    productType: varchar('product_type', { length: 50 }),
    description: text('description'),
    status: vendorStatusEnum('status').notNull().default('pending'),
    commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }),
    approvedBy: text('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('vendors_user_event_unique').on(table.userId, table.eventId),
    index('vendors_event_id_idx').on(table.eventId),
    index('vendors_event_status_idx').on(table.eventId, table.status),
    index('vendors_user_id_idx').on(table.userId),
  ],
);
