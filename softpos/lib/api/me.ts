import { api } from '../api';
import type { Memberships } from '@/types/api';

export const meApi = {
  async getMemberships(): Promise<Memberships> {
    const res = await api.get<Memberships>('/me/memberships');
    return res.data;
  },
};
