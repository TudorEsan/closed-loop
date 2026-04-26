import {
  pgTable,
  text,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { eventTicketStatusEnum } from './enums';
import { users } from './auth';
import { events } from './events';
import { eventBracelets } from './event-bracelets';

// A ticket is an admin-issued invitation for someone to join an event.
// It carries a one-time token that, once delivered by email and shown
// at the gate as a QR, lets an operator bind a wristband to the user
// behind that email. The user does not need to have an account at the
// time the ticket is issued, the account is provisioned on redeem.
export const eventTickets = pgTable(
  'event_tickets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    email: varchar('email', { length: 255 }).notNull(),
    userId: text('user_id').references(() => users.id),
    token: text('token').notNull(),
    status: eventTicketStatusEnum('status').notNull().default('pending'),
    issuedBy: text('issued_by')
      .notNull()
      .references(() => users.id),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    redeemedBraceletId: text('redeemed_bracelet_id').references(
      () => eventBracelets.id,
    ),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: text('revoked_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('event_tickets_token_idx').on(table.token),
    index('event_tickets_event_idx').on(table.eventId),
    index('event_tickets_email_idx').on(table.email),
    index('event_tickets_status_idx').on(table.status),
    index('event_tickets_event_email_idx').on(table.eventId, table.email),
  ],
);
