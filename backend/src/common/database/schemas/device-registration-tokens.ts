import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { vendors } from './vendors';
import { users } from './auth';

export const deviceRegistrationTokens = pgTable(
  'device_registration_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    vendorId: text('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('device_reg_tokens_vendor_id_idx').on(table.vendorId),
    index('device_reg_tokens_token_idx').on(table.token),
  ],
);
