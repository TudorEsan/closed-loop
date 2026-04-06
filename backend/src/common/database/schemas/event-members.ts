import { pgTable, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { eventMemberRoleEnum } from './enums';
import { users } from './auth';
import { events } from './events';

export const eventMembers = pgTable('event_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: eventMemberRoleEnum('role').notNull(),
  invitedBy: text('invited_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('event_members_unique').on(table.eventId, table.userId),
  index('event_members_event_id_idx').on(table.eventId),
  index('event_members_user_id_idx').on(table.userId),
]);
