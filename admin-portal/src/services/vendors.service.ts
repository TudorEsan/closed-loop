import { api } from '@/lib/api';
import type {
  Vendor,
  CreateVendorDto,
  VendorQuery,
  PaginatedVendors,
  VendorMember,
  AddVendorMemberDto,
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

  listMembers(eventId: string, vendorId: string) {
    return api.get<VendorMember[]>(
      `/events/${eventId}/vendors/${vendorId}/members`,
    );
  },

  addMember(eventId: string, vendorId: string, data: AddVendorMemberDto) {
    return api.post<VendorMember>(
      `/events/${eventId}/vendors/${vendorId}/members`,
      data,
    );
  },

  updateMemberRole(
    eventId: string,
    vendorId: string,
    memberId: string,
    role: 'manager' | 'cashier',
  ) {
    return api.patch<VendorMember>(
      `/events/${eventId}/vendors/${vendorId}/members/${memberId}`,
      { role },
    );
  },

  removeMember(eventId: string, vendorId: string, memberId: string) {
    return api.delete(
      `/events/${eventId}/vendors/${vendorId}/members/${memberId}`,
    );
  },
};
