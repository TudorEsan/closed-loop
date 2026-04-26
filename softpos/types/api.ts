// Shared types that mirror what the backend returns. Kept lean: only fields
// we actually consume in the app.

export type UserRole = 'super_admin' | 'user';

export type EventMemberRole = 'admin' | 'operator';
export type VendorMemberRole = 'owner' | 'manager' | 'cashier';

export type EventMembership = {
  eventId: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string | null;
  role: EventMemberRole;
  isOrganizer: boolean;
};

export type VendorMembership = {
  vendorId: string;
  businessName: string;
  status: VendorStatus;
  eventId: string;
  eventName: string;
  role: VendorMemberRole;
};

export type Memberships = {
  isSuperAdmin: boolean;
  events: EventMembership[];
  vendors: VendorMembership[];
};

export type Scope =
  | { kind: 'attendee' }
  | { kind: 'event'; event: EventMembership }
  | { kind: 'vendor'; vendor: VendorMembership };

export type EventSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type EventBracelet = {
  id: string;
  eventId: string;
  userId: string;
  wristbandUid: string;
  status: 'active' | 'revoked' | 'replaced';
  balance: number;
  debitCounterSeen: number;
  creditCounter: number;
  linkedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionType = 'debit' | 'credit';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'flagged';

export type Transaction = {
  id: string;
  eventBraceletId: string;
  vendorId: string | null;
  operatorId: string | null;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  offline: boolean;
  debitCounter: number | null;
  creditCounter: number | null;
  serverTimestamp: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  // Filled in by /me/transactions, the event the bracelet belongs to.
  eventId?: string;
  eventName?: string;
};

export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export const VENDOR_PRODUCT_TYPES = [
  'food',
  'drinks',
  'alcohol',
  'merchandise',
  'art',
  'services',
  'other',
] as const;

export type VendorProductType = (typeof VENDOR_PRODUCT_TYPES)[number];

export const VENDOR_PRODUCT_TYPE_LABELS: Record<VendorProductType, string> = {
  food: 'Food',
  drinks: 'Drinks',
  alcohol: 'Alcohol',
  merchandise: 'Merchandise',
  art: 'Art',
  services: 'Services',
  other: 'Other',
};

export type Vendor = {
  id: string;
  userId: string;
  eventId: string;
  businessName: string;
  contactPerson: string;
  contactEmail: string | null;
  productType: VendorProductType | null;
  description: string | null;
  status: VendorStatus;
  commissionRate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceStatus =
  | 'pending_approval'
  | 'active'
  | 'blocked'
  | 'decommissioned';

export type Device = {
  id: string;
  vendorId: string;
  deviceModel: string | null;
  osName: string | null;
  osVersion: string | null;
  appVersion: string | null;
  status: DeviceStatus;
  approvedAt: string | null;
  keyProvisionedAt: string | null;
  createdAt: string;
};
