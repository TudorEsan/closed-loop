import { api } from '../api';
import type { EventSummary } from '@/types/api';

export const eventsApi = {
  async list(): Promise<EventSummary[]> {
    const res = await api.get<{ events: EventSummary[] } | EventSummary[]>(
      '/events',
    );
    const data = res.data as { events?: EventSummary[] } | EventSummary[];
    if (Array.isArray(data)) return data;
    return data.events ?? [];
  },
  async get(id: string): Promise<EventSummary> {
    const res = await api.get<EventSummary>(`/events/${id}`);
    return res.data;
  },
};
