import { pgTable, text, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { vendorInvitationStatusEnum, vendorMemberRoleEnum } from './enums';
import { users } from './auth';
import { vendors } from './vendors';

export const vendorInvitations = pgTable('vendor_invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: vendorMemberRoleEnum('role').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  status: vendorInvitationStatusEnum('status').notNull().default('pending'),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  acceptedBy: text('accepted_by').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('vendor_invitations_vendor_id_idx').on(table.vendorId),
  index('vendor_invitations_token_idx').on(table.token),
  index('vendor_invitations_email_idx').on(table.email),
]);
