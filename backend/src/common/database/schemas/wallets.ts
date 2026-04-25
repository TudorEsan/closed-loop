import {
  pgTable,
  text,
  timestamp,
  integer,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { walletStatusEnum } from './enums';
import { users } from './auth';

// User-wide wallet. One balance per user, usable across any event. We
// dropped the per-event wallet model because the UX got weird (topup asked
// you to pick an event first). Event-specific float tracking now happens
// on the transaction side (each spend carries its eventId), and per-event
// reconciliation can still be done by summing transactions grouped by
// event when needed. Bracelet-to-user-per-event linking is in the
// event_bracelets table, which is the only authoritative source for
// "who holds which wristband at which festival".
export const wallets = pgTable(
  'wallets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    balance: integer('balance').notNull().default(0),
    status: walletStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('wallets_user_unique').on(table.userId),
    check('wallets_balance_check', sql`${table.balance} >= 0`),
  ],
);
