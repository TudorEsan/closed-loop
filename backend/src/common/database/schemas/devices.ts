import { pgTable, text, varchar, timestamp, integer, decimal, index } from 'drizzle-orm/pg-core';
import { deviceStatusEnum } from './enums';
import { vendors } from './vendors';
import { users } from './auth';

export const devices = pgTable('devices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  deviceIdentifier: varchar('device_identifier', { length: 255 }).notNull().unique(),
  deviceName: varchar('device_name', { length: 255 }),

  // Device metadata (collected from the POS app during registration)
  deviceModel: varchar('device_model', { length: 255 }),
  osName: varchar('os_name', { length: 50 }),
  osVersion: varchar('os_version', { length: 50 }),
  appVersion: varchar('app_version', { length: 50 }),
  screenWidth: integer('screen_width'),
  screenHeight: integer('screen_height'),

  // Location and network info at registration
  registrationLatitude: decimal('registration_latitude', { precision: 10, scale: 7 }),
  registrationLongitude: decimal('registration_longitude', { precision: 10, scale: 7 }),
  registrationIpAddress: varchar('registration_ip_address', { length: 45 }),

  // Device fingerprint (hash of hardware attributes for uniqueness)
  deviceFingerprint: varchar('device_fingerprint', { length: 512 }),

  // Registration token used
  registrationTokenId: text('registration_token_id'),

  // Approval flow
  status: deviceStatusEnum('status').notNull().default('pending_approval'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),

  // Key provisioning tracking
  keyProvisionedAt: timestamp('key_provisioned_at', { withTimezone: true }),
  keyVersion: integer('key_version'),
  keyDerivationSalt: varchar('key_derivation_salt', { length: 255 }),

  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  transactionCount: integer('transaction_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('devices_vendor_id_idx').on(table.vendorId),
  index('devices_status_idx').on(table.status),
  index('devices_fingerprint_idx').on(table.deviceFingerprint),
]);
