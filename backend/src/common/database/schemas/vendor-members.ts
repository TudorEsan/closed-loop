import { pgTable, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { vendorMemberRoleEnum } from './enums';
import { users } from './auth';
import { vendors } from './vendors';

export const vendorMembers = pgTable(
  'vendor_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    vendorId: text('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: vendorMemberRoleEnum('role').notNull(),
    invitedBy: text('invited_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('vendor_members_unique').on(table.vendorId, table.userId),
    index('vendor_members_vendor_id_idx').on(table.vendorId),
    index('vendor_members_user_id_idx').on(table.userId),
  ],
);
