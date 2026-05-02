import { api } from '../api';
import type { Transaction } from '@/types/api';
import type { ChipStateWire } from '@/types/sync';

export type ChargeBody = {
  wristbandUid: string;
  amount: number;
  deviceId: string;
  idempotencyKey: string;
  chipState: ChipStateWire;
};

export type ChargeResponse = {
  transaction: Transaction;
  bracelet: {
    id: string;
    balance: number;
    debit_counter_seen: number;
    credit_counter: number;
  };
  chipShouldWrite: {
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
    const res = await api.post<ChargeResponse>(
      `/events/${eventId}/vendors/${vendorId}/transactions/charge`,
      body,
    );
    return res.data;
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
