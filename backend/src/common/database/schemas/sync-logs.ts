import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { syncStatusEnum } from './enums';
import { devices } from './devices';
import { events } from './events';

export const syncLogs = pgTable('sync_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id').notNull().references(() => devices.id),
  eventId: text('event_id').notNull().references(() => events.id),
  transactionCount: integer('transaction_count').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  status: syncStatusEnum('status').notNull(),
  errorDetails: text('error_details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sync_logs_event_device_idx').on(table.eventId, table.deviceId),
  index('sync_logs_synced_at_idx').on(table.syncedAt),
]);
