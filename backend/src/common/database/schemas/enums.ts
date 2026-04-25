import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'admin',
  'operator',
  'vendor',
  'attendee',
]);
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
export const eventMemberRoleEnum = pgEnum('event_member_role', [
  'organizer',
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
