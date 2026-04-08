import { api } from '../api';
import type { Wallet, Transaction } from '@/types/api';

// Wallet/transactions endpoints. The backend may not have all of these wired
// yet, screens should handle 404s gracefully.
export const walletsApi = {
  async getMyWallet(eventId: string): Promise<Wallet | null> {
    try {
      const res = await api.get<Wallet>(`/events/${eventId}/wallets/me`);
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  async listMyTransactions(
    eventId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<{ transactions: Transaction[]; nextCursor: string | null }> {
    const res = await api.get(`/events/${eventId}/wallets/me/transactions`, {
      params,
    });
    return res.data;
  },

  async topUp(
    eventId: string,
    body: { amount: number; method: 'card' | 'cash' },
  ): Promise<Transaction> {
    const res = await api.post<Transaction>(
      `/events/${eventId}/wallets/me/topup`,
      body,
    );
    return res.data;
  },
};
