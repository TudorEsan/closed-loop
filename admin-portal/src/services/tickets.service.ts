import { api } from '@/lib/api';
import type {
  IssueTicketDto,
  ListTicketsResponse,
  Ticket,
  TicketStatus,
} from '@/types/ticket';

export const ticketsService = {
  list(eventId: string, params?: { status?: TicketStatus; search?: string }) {
    return api.get<ListTicketsResponse>(`/events/${eventId}/tickets`, {
      params,
    });
  },

  issue(eventId: string, data: IssueTicketDto) {
    return api.post<Ticket>(`/events/${eventId}/tickets`, data);
  },

  revoke(eventId: string, ticketId: string) {
    return api.delete<Ticket>(`/events/${eventId}/tickets/${ticketId}`);
  },
};
