import { api } from '../api';
import type { Transaction } from '@/types/api';

export type ChargeBody = {
  walletId?: string;
  wristbandUid?: string;
  amount: number;
  deviceId: string;
  idempotencyKey: string;
  clientTimestamp: string;
  // Server uses this to write back the new credit_counter when it
  // returns the next chip state.
  debitCounter?: number;
  metadata?: Record<string, unknown>;
};

export type ChargeResponse = {
  transaction: Transaction;
  chipShouldWrite?: {
    balance: number;
    credit_counter: number;
  };
};

export const transactionsApi = {
  async charge(
    eventId: string,
    vendorId: string,
    body: ChargeBody,
  ): Promise<ChargeResponse> {
    const res = await api.post<Transaction | ChargeResponse>(
      `/events/${eventId}/vendors/${vendorId}/transactions/charge`,
      body,
    );
    // Backwards compatible: older backend returned the transaction
    // directly; newer one wraps it with chipShouldWrite.
    const data = res.data as Transaction | ChargeResponse;
    if ('transaction' in data) return data;
    return { transaction: data };
  },

  async listForVendor(
    eventId: string,
    vendorId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<{ transactions: Transaction[]; nextCursor: string | null }> {
    const res = await api.get(
      `/events/${eventId}/vendors/${vendorId}/transactions`,
      { params },
    );
    return res.data;
  },
};
