import { api } from '../api';
import type { EventSummary } from '@/types/api';

export type MyEventRow = EventSummary & {
  location: string | null;
  linkedWristbandUid: string | null;
};

export type LinkTokenResponse = {
  token: string;
  expiresAt: number;
};

export type LinkByTokenResponse = {
  id: string;
  eventId: string;
  userId: string;
  wristbandUid: string;
  status: 'active' | 'revoked' | 'replaced';
};

export const braceletsApi = {
  async myEvents(): Promise<MyEventRow[]> {
    const res = await api.get<{ events: MyEventRow[] }>('/me/events');
    return res.data.events ?? [];
  },

  async issueLinkToken(eventId: string): Promise<LinkTokenResponse> {
    const res = await api.post<LinkTokenResponse>(
      `/me/events/${eventId}/link-token`,
    );
    return res.data;
  },

  async linkByToken(args: {
    eventId: string;
    linkToken: string;
    wristbandUid: string;
  }): Promise<LinkByTokenResponse> {
    const res = await api.post<LinkByTokenResponse>(
      `/events/${args.eventId}/bracelets/link-by-token`,
      { linkToken: args.linkToken, wristbandUid: args.wristbandUid },
    );
    return res.data;
  },
};
