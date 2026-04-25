import { pgTable, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { deviceOperatorStatusEnum } from './enums';
import { users } from './auth';
import { devices } from './devices';

export const deviceOperators = pgTable(
  'device_operators',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: deviceOperatorStatusEnum('status').notNull().default('active'),
    assignedBy: text('assigned_by')
      .notNull()
      .references(() => users.id),
    revokedBy: text('revoked_by').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('device_operators_unique').on(table.deviceId, table.userId),
    index('device_operators_device_id_idx').on(table.deviceId),
    index('device_operators_user_id_idx').on(table.userId),
  ],
);
