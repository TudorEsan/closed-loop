import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { braceletAssignmentStatusEnum } from './enums';
import { users } from './auth';
import { events } from './events';

// Festival-scoped link between a wristband UID and a user, plus the live
// balance and counters that make this row act as the wallet for the event.
// One wristband can be linked to one user per event at a time, and one user
// can hold one active bracelet per event at a time. Older assignments stay
// around with status 'revoked' or 'replaced' for audit and offline
// reconciliation.
export const eventBracelets = pgTable(
  'event_bracelets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    wristbandUid: varchar('wristband_uid', { length: 255 }).notNull(),
    status: braceletAssignmentStatusEnum('status').notNull().default('active'),
    // The bracelet IS the wallet now: balance lives here, scoped to the
    // event. debit_counter_seen mirrors the chip's monotonic debit counter
    // and only moves up when we apply a debit (online charge or offline
    // batch sync). credit_counter is server-owned and bumps on every
    // successful credit (topup, refund) to give the chip a freshness check.
    balance: integer('balance').notNull().default(0),
    debitCounterSeen: integer('debit_counter_seen').notNull().default(0),
    creditCounter: integer('credit_counter').notNull().default(0),
    linkedAt: timestamp('linked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    linkedBy: text('linked_by')
      .notNull()
      .references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: text('revoked_by').references(() => users.id),
    revokeReason: text('revoke_reason'),
    replacedByAssignmentId: text('replaced_by_assignment_id'),
    tokenIssuedAt: timestamp('token_issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    tokenExpiresAt: timestamp('token_expires_at', {
      withTimezone: true,
    }).notNull(),
    tokenVersion: integer('token_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('event_bracelets_active_uid_idx')
      .on(table.eventId, table.wristbandUid)
      .where(sql`status = 'active'`),
    uniqueIndex('event_bracelets_active_user_idx')
      .on(table.eventId, table.userId)
      .where(sql`status = 'active'`),
    index('event_bracelets_event_idx').on(table.eventId),
    index('event_bracelets_user_idx').on(table.userId),
    index('event_bracelets_status_idx').on(table.status),
    check('event_bracelets_balance_check', sql`${table.balance} >= 0`),
  ],
);
