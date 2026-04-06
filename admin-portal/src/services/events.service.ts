import { api } from '@/lib/api';
import type {
  Event,
  CreateEventDto,
  EventQuery,
  PaginatedEvents,
  EventMember,
  EventMemberRole,
} from '@/types';

export const eventsService = {
  list(query?: EventQuery) {
    return api.get<PaginatedEvents>('/events', { params: query });
  },

  getById(id: string) {
    return api.get<Event>(`/events/${id}`);
  },

  create(data: CreateEventDto) {
    return api.post<Event>('/events', data);
  },

  update(id: string, data: Partial<CreateEventDto>) {
    return api.patch<Event>(`/events/${id}`, data);
  },

  updateStatus(id: string, status: Event['status']) {
    return api.patch<Event>(`/events/${id}/status`, { status });
  },

  delete(id: string) {
    return api.delete(`/events/${id}`);
  },

  listMembers(eventId: string) {
    return api.get<EventMember[]>(`/events/${eventId}/members`);
  },

  addMember(eventId: string, userId: string, role: EventMemberRole) {
    return api.post<EventMember>(`/events/${eventId}/members`, { userId, role });
  },

  removeMember(eventId: string, memberId: string) {
    return api.delete(`/events/${eventId}/members/${memberId}`);
  },
};
