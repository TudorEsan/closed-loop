import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { transactionTypeEnum, transactionStatusEnum } from './enums';
import { users } from './auth';
import { eventBracelets } from './event-bracelets';
import { vendors } from './vendors';

// One row per money movement on a specific bracelet. The kind of movement
// is captured by `type` (debit | credit) and the matching counter column
// is filled in: debit_counter for debits (the value the chip held when
// the debit happened, server-allocated for online charges), credit_counter
// for credits (always server-allocated, monotonic per bracelet). Event
// scoping is implicit through the bracelet, no separate event_id column.
export const transactions = pgTable(
  'transactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventBraceletId: text('event_bracelet_id')
      .notNull()
      .references(() => eventBracelets.id),
    vendorId: text('vendor_id').references(() => vendors.id),
    operatorId: text('operator_id').references(() => users.id),
    type: transactionTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),
    status: transactionStatusEnum('status').notNull().default('completed'),
    offline: boolean('offline').notNull().default(false),
    debitCounter: integer('debit_counter'),
    creditCounter: integer('credit_counter'),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }),
    serverTimestamp: timestamp('server_timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('transactions_bracelet_idx').on(table.eventBraceletId),
    index('transactions_vendor_idx').on(table.vendorId),
    index('transactions_created_idx').on(table.createdAt),
    index('transactions_type_idx').on(table.type),
    check('transactions_amount_check', sql`${table.amount} > 0`),
  ],
);
