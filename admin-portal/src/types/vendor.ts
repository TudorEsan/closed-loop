export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type Vendor = {
  id: string;
  userId: string;
  eventId: string;
  businessName: string;
  contactPerson: string;
  contactEmail: string | null;
  contactPhone: string | null;
  productType: string | null;
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
  contactPhone?: string;
  productType?: string;
  description?: string;
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
