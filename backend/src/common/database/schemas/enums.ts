import { pgEnum } from 'drizzle-orm/pg-core';

// Global role on the users table. Authority over a specific event or vendor
// is held by membership rows (eventMembers, vendorMembers), not by this enum.
// `super_admin` is the only platform-wide privileged role.
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'user']);
export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'setup',
  'active',
  'settlement',
  'closed',
]);
export const vendorStatusEnum = pgEnum('vendor_status', [
  'pending',
  'approved',
  'rejected',
  'suspended',
]);
// Two kinds of money movement on a bracelet. `debit` is a spend, paired with
// the bracelet's debit_counter. `credit` is a topup or refund, paired with
// the server-owned credit_counter. The old payment / topup_* / refund /
// cashout split went away once counters carry the rest of the meaning.
export const transactionTypeEnum = pgEnum('transaction_type', [
  'debit',
  'credit',
]);
export const transactionStatusEnum = pgEnum('transaction_status', [
  'completed',
  'pending',
  'failed',
  'flagged',
]);
// Per-event role. The event creator is captured via `events.organizerId` and
// is treated as an implicit admin, so we no longer need an `organizer` value
// here.
export const eventMemberRoleEnum = pgEnum('event_member_role', [
  'admin',
  'operator',
]);
export const vendorMemberRoleEnum = pgEnum('vendor_member_role', [
  'owner',
  'manager',
  'cashier',
]);
export const paymentIntentStatusEnum = pgEnum('payment_intent_status', [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'canceled',
]);
export const braceletAssignmentStatusEnum = pgEnum(
  'bracelet_assignment_status',
  ['active', 'revoked', 'replaced'],
);
export const eventTicketStatusEnum = pgEnum('event_ticket_status', [
  'pending',
  'redeemed',
  'revoked',
  'expired',
]);
