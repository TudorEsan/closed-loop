import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { braceletAssignmentStatusEnum } from './enums';
import { users } from './auth';
import { events } from './events';

// Festival-scoped link between a wristband UID and a user. Replaces the
// legacy user-wide wallets.wristband_uid which could not capture "this
// bracelet belongs to user X for festival Y". One wristband can be linked
// to one user per event at a time, and one user can hold one active
// bracelet per event at a time. Older assignments stay around with status
// 'revoked' or 'replaced' for audit and offline reconciliation.
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
  ],
);
