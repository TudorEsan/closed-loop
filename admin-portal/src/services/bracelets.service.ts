import { api } from '@/lib/api';
import type {
  BraceletAssignment,
  BraceletQuery,
  LinkBraceletDto,
  PaginatedBracelets,
  ReplaceBraceletDto,
  RevokeBraceletDto,
} from '@/types';

export const braceletsService = {
  list(eventId: string, query?: BraceletQuery) {
    return api.get<PaginatedBracelets>(`/events/${eventId}/bracelets`, { params: query });
  },

  getById(eventId: string, id: string) {
    return api.get<BraceletAssignment>(`/events/${eventId}/bracelets/${id}`);
  },

  link(eventId: string, data: LinkBraceletDto) {
    return api.post<BraceletAssignment>(`/events/${eventId}/bracelets`, data);
  },

  revoke(eventId: string, id: string, data: RevokeBraceletDto) {
    return api.patch<BraceletAssignment>(`/events/${eventId}/bracelets/${id}/revoke`, data);
  },

  replace(eventId: string, id: string, data: ReplaceBraceletDto) {
    return api.post<{ previous: BraceletAssignment; current: BraceletAssignment }>(
      `/events/${eventId}/bracelets/${id}/replace`,
      data,
    );
  },

  syncBundle(eventId: string) {
    return api.get<{
      eventId: string;
      generatedAt: string;
      assignments: BraceletAssignment[];
    }>(`/events/${eventId}/bracelets/sync-bundle`);
  },
};
