import { api } from '../api';
import type { EventSummary } from '@/types/api';

export type MyEventRow = EventSummary & {
  location: string | null;
  linkedWristbandUid: string | null;
};

export type RedeemTicketResponse = {
  ticketId: string;
  eventId: string;
  eventName: string;
  email: string;
  userId: string;
  bracelet: {
    id: string;
    eventId: string;
    userId: string;
    wristbandUid: string;
    status: 'active' | 'revoked' | 'replaced';
  };
};

export const braceletsApi = {
  async myEvents(): Promise<MyEventRow[]> {
    const res = await api.get<{ events: MyEventRow[] }>('/me/events');
    return res.data.events ?? [];
  },

  async redeemTicket(args: {
    token: string;
    wristbandUid: string;
  }): Promise<RedeemTicketResponse> {
    const res = await api.post<RedeemTicketResponse>('/tickets/redeem', {
      token: args.token,
      wristbandUid: args.wristbandUid,
    });
    return res.data;
  },
};
