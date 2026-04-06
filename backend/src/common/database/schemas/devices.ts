import { pgTable, text, varchar, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { deviceStatusEnum } from './enums';
import { vendors } from './vendors';

export const devices = pgTable('devices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  deviceIdentifier: varchar('device_identifier', { length: 255 }).notNull().unique(),
  deviceName: varchar('device_name', { length: 255 }),
  status: deviceStatusEnum('status').notNull().default('active'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  transactionCount: integer('transaction_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('devices_vendor_id_idx').on(table.vendorId),
]);
