import { pgTable, text, varchar, timestamp, integer, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { walletStatusEnum } from './enums';
import { users } from './auth';
import { events } from './events';

export const wallets = pgTable('wallets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  eventId: text('event_id').notNull().references(() => events.id),
  balance: integer('balance').notNull().default(0),
  wristbandUid: varchar('wristband_uid', { length: 255 }),
  status: walletStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('wallets_user_event_unique').on(table.userId, table.eventId),
  index('wallets_event_wristband_idx').on(table.eventId, table.wristbandUid),
  index('wallets_user_id_idx').on(table.userId),
  check('wallets_balance_check', sql`${table.balance} >= 0`),
]);
