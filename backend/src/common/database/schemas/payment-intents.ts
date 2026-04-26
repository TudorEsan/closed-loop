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
import { eventBracelets } from './event-bracelets';
import { transactions } from './transactions';

// Provider-agnostic record of a pending topup. Mobile app hits "Add funds"
// while standing at a specific bracelet (the one the user wears at the
// event), we create a row here and ask the provider for a payment intent.
// On webhook success we credit that exact bracelet, not the user globally.
export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    eventBraceletId: text('event_bracelet_id')
      .notNull()
      .references(() => eventBracelets.id),

    provider: varchar('provider', { length: 32 }).notNull(),
    providerIntentId: varchar('provider_intent_id', { length: 255 })
      .notNull()
      .unique(),

    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),

    status: paymentIntentStatusEnum('status').notNull().default('pending'),

    transactionId: text('transaction_id').references(() => transactions.id),

    metadata: jsonb('metadata'),
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
    index('payment_intents_bracelet_id_idx').on(table.eventBraceletId),
    index('payment_intents_status_idx').on(table.status),
    check('payment_intents_amount_check', sql`${table.amount} > 0`),
  ],
);
