import { api } from '../api';
import type { Vendor, VendorProductType } from '@/types/api';

export const vendorsApi = {
  async listForEvent(eventId: string): Promise<Vendor[]> {
    const res = await api.get<{ vendors: Vendor[] } | Vendor[]>(
      `/events/${eventId}/vendors`,
    );
    const data = res.data as { vendors?: Vendor[] } | Vendor[];
    if (Array.isArray(data)) return data;
    return data.vendors ?? [];
  },

  async create(
    eventId: string,
    body: {
      businessName: string;
      contactPerson: string;
      contactEmail?: string;
      productType?: VendorProductType;
      description?: string;
    },
  ): Promise<Vendor> {
    const res = await api.post<Vendor>(`/events/${eventId}/vendors`, body);
    return res.data;
  },

  async get(eventId: string, vendorId: string): Promise<Vendor> {
    const res = await api.get<Vendor>(`/events/${eventId}/vendors/${vendorId}`);
    return res.data;
  },
};
