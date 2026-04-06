import { api } from '@/lib/api';
import type {
  Vendor,
  CreateVendorDto,
  VendorQuery,
  PaginatedVendors,
} from '@/types';

export const vendorsService = {
  list(eventId: string, query?: VendorQuery) {
    return api.get<PaginatedVendors>(`/events/${eventId}/vendors`, { params: query });
  },

  getById(eventId: string, vendorId: string) {
    return api.get<Vendor>(`/events/${eventId}/vendors/${vendorId}`);
  },

  create(eventId: string, data: CreateVendorDto) {
    return api.post<Vendor>(`/events/${eventId}/vendors`, data);
  },

  update(eventId: string, vendorId: string, data: Partial<CreateVendorDto>) {
    return api.patch<Vendor>(`/events/${eventId}/vendors/${vendorId}`, data);
  },

  updateStatus(eventId: string, vendorId: string, status: Vendor['status']) {
    return api.patch<Vendor>(`/events/${eventId}/vendors/${vendorId}/status`, { status });
  },

  updateCommission(eventId: string, vendorId: string, commissionRate: number) {
    return api.patch<Vendor>(`/events/${eventId}/vendors/${vendorId}/commission`, { commissionRate });
  },

  remove(eventId: string, vendorId: string) {
    return api.delete(`/events/${eventId}/vendors/${vendorId}`);
  },
};
