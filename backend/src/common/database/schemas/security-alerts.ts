import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { alertTypeEnum, alertSeverityEnum } from './enums';
import { users } from './auth';
import { events } from './events';
import { devices } from './devices';
import { wallets } from './wallets';

export const securityAlerts = pgTable(
  'security_alerts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    type: alertTypeEnum('type').notNull(),
    severity: alertSeverityEnum('severity').notNull().default('medium'),
    deviceId: text('device_id').references(() => devices.id),
    walletId: text('wallet_id').references(() => wallets.id),
    description: text('description').notNull(),
    resolved: boolean('resolved').notNull().default(false),
    resolvedBy: text('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('security_alerts_event_resolved_idx').on(
      table.eventId,
      table.resolved,
    ),
    index('security_alerts_event_type_idx').on(table.eventId, table.type),
    index('security_alerts_created_at_idx').on(table.createdAt),
  ],
);
