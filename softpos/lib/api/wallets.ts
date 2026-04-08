import { api } from '../api';
import type { Wallet, Transaction } from '@/types/api';

// User wallet endpoints. Balance is one pool per user, usable at any
// event, so none of these take an eventId.
export const walletsApi = {
  async getMyWallet(): Promise<Wallet | null> {
    try {
      const res = await api.get<Wallet>(`/wallets/me`);
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  async listMyTransactions(
    params?: { limit?: number; cursor?: string },
  ): Promise<{ transactions: Transaction[]; nextCursor: string | null }> {
    const res = await api.get(`/wallets/me/transactions`, { params });
    return res.data;
  },
};
