import { pgTable, text, varchar, date, timestamp, decimal, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { eventStatusEnum } from './enums';
import { users } from './auth';

export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  organizerId: text('organizer_id').notNull().references(() => users.id),
  status: eventStatusEnum('status').notNull().default('draft'),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  tokenCurrencyRate: decimal('token_currency_rate', { precision: 10, scale: 4 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Europe/Bucharest'),
  location: varchar('location', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('events_organizer_id_idx').on(table.organizerId),
  index('events_status_idx').on(table.status),
  index('events_dates_idx').on(table.startDate, table.endDate),
  check('events_dates_check', sql`${table.startDate} < ${table.endDate}`),
  check('events_token_rate_check', sql`${table.tokenCurrencyRate} > 0`),
]);
