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
import { events } from './events';
import { wallets } from './wallets';
import { vendors } from './vendors';

export const transactions = pgTable(
  'transactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // eventId is nullable because topups happen at the user level now (no
    // event). Spending at a POS still carries the eventId of the festival
    // where it happened.
    eventId: text('event_id').references(() => events.id),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallets.id),
    vendorId: text('vendor_id').references(() => vendors.id),
    operatorId: text('operator_id').references(() => users.id),
    type: transactionTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),
    status: transactionStatusEnum('status').notNull().default('pending'),
    offline: boolean('offline').notNull().default(false),
    transactionCounter: integer('transaction_counter'),
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
    index('transactions_event_wallet_idx').on(table.eventId, table.walletId),
    index('transactions_event_vendor_idx').on(table.eventId, table.vendorId),
    index('transactions_event_created_idx').on(table.eventId, table.createdAt),
    index('transactions_event_type_idx').on(table.eventId, table.type),
    check('transactions_amount_check', sql`${table.amount} > 0`),
  ],
);
