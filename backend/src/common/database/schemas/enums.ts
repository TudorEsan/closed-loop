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
export const deviceStatusEnum = pgEnum('device_status', [
  'pending_approval',
  'active',
  'blocked',
  'decommissioned',
]);
export const walletStatusEnum = pgEnum('wallet_status', [
  'active',
  'frozen',
  'closed',
]);
export const transactionTypeEnum = pgEnum('transaction_type', [
  'payment',
  'topup_online',
  'topup_cash',
  'refund',
  'cashout',
]);
export const transactionStatusEnum = pgEnum('transaction_status', [
  'completed',
  'pending',
  'failed',
  'flagged',
]);
export const syncStatusEnum = pgEnum('sync_status', [
  'success',
  'partial',
  'failed',
]);
export const alertTypeEnum = pgEnum('alert_type', [
  'chain_break',
  'root_detected',
  'long_offline',
  'balance_mismatch',
  'suspicious_activity',
  'unauthorized_device',
  'unauthorized_operator',
]);
export const alertSeverityEnum = pgEnum('alert_severity', [
  'low',
  'medium',
  'high',
  'critical',
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
export const vendorInvitationStatusEnum = pgEnum('vendor_invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
]);
export const deviceOperatorStatusEnum = pgEnum('device_operator_status', [
  'active',
  'revoked',
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
