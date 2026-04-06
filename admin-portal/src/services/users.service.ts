import { api } from '@/lib/api';
import type { User, UserRole, UserQuery, PaginatedUsers } from '@/types';

export const usersService = {
  list(query?: UserQuery) {
    return api.get<PaginatedUsers>('/users', { params: query });
  },

  getById(id: string) {
    return api.get<User>(`/users/${id}`);
  },

  update(id: string, data: { name?: string; phone?: string }) {
    return api.patch<User>(`/users/${id}`, data);
  },

  updateRole(id: string, role: UserRole) {
    return api.patch<User>(`/users/${id}/role`, { role });
  },

  deactivate(id: string) {
    return api.delete(`/users/${id}`);
  },
};
