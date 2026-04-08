import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { paymentIntentStatusEnum } from './enums';
import { users } from './auth';
import { wallets } from './wallets';
import { transactions } from './transactions';

// Provider-agnostic record of a pending topup. When a user hits "Add funds",
// we create a row here first, then ask the payment provider (Stripe today)
// to create their own intent. Once the provider fires the success webhook
// we flip status to succeeded and credit the wallet.
//
// Note: no eventId. Topups are user-level now, the balance lives on the
// user's wallet and can be spent at any event.
export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Who is paying
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallets.id),

    // Provider identity. We keep the provider name separately so we can
    // swap stripe for something else without a schema change.
    provider: varchar('provider', { length: 32 }).notNull(),
    providerIntentId: varchar('provider_intent_id', { length: 255 })
      .notNull()
      .unique(),

    // Money (minor units, e.g. cents) + ISO currency code
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),

    status: paymentIntentStatusEnum('status').notNull().default('pending'),

    // Link to the wallet transaction we create on success (null until then)
    transactionId: text('transaction_id').references(() => transactions.id),

    // Whatever extra stuff the provider gives back (last4, receipt_url, etc.)
    metadata: jsonb('metadata'),

    // Reason we failed, if we failed
    failureReason: text('failure_reason'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payment_intents_user_id_idx').on(table.userId),
    index('payment_intents_wallet_id_idx').on(table.walletId),
    index('payment_intents_status_idx').on(table.status),
    check('payment_intents_amount_check', sql`${table.amount} > 0`),
  ],
);
