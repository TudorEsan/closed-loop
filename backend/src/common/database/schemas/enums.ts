import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'operator', 'vendor', 'attendee']);
export const eventStatusEnum = pgEnum('event_status', ['draft', 'setup', 'active', 'settlement', 'closed']);
export const vendorStatusEnum = pgEnum('vendor_status', ['pending', 'approved', 'rejected', 'suspended']);
export const deviceStatusEnum = pgEnum('device_status', ['active', 'blocked']);
export const walletStatusEnum = pgEnum('wallet_status', ['active', 'frozen', 'closed']);
export const transactionTypeEnum = pgEnum('transaction_type', ['payment', 'topup_online', 'topup_cash', 'refund', 'cashout']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'pending', 'failed', 'flagged']);
export const syncStatusEnum = pgEnum('sync_status', ['success', 'partial', 'failed']);
export const alertTypeEnum = pgEnum('alert_type', ['chain_break', 'root_detected', 'long_offline', 'balance_mismatch', 'suspicious_activity']);
export const alertSeverityEnum = pgEnum('alert_severity', ['low', 'medium', 'high', 'critical']);
export const eventMemberRoleEnum = pgEnum('event_member_role', ['organizer', 'admin', 'operator']);
