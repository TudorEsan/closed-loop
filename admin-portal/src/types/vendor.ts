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
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateVendorDto = {
  businessName: string;
  contactPerson: string;
  contactEmail?: string;
  productType?: VendorProductType;
  description?: string;
  targetUserId?: string;
};

export type VendorMemberRole = 'owner' | 'manager' | 'cashier';

export type VendorMember = {
  id: string;
  userId: string;
  role: VendorMemberRole;
  invitedBy: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
};

export type AddVendorMemberDto = {
  userId?: string;
  email?: string;
  role: 'manager' | 'cashier';
};

export type VendorQuery = {
  status?: VendorStatus;
  search?: string;
  limit?: number;
  cursor?: string;
};

export type PaginatedVendors = {
  vendors: Vendor[];
  nextCursor: string | null;
};
