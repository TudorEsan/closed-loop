import { api } from '../api';

export type ChipStateSnapshot = {
  balance: number;
  debit_counter: number;
  credit_counter_seen: number;
};

export type SyncRequestDebit = {
  idempotencyKey: string;
  amount: number;
  vendorId: string;
  counterValue: number;
  deviceId: string;
  clientTimestamp: string;
};

export type SyncRequestBody = {
  chipState: ChipStateSnapshot;
  pendingDebits: SyncRequestDebit[];
};

export type RejectedReason =
  | 'duplicate'
  | 'insufficient_funds'
  | 'counter_gap'
  | 'invalid';

export type SyncResponse = {
  serverState: {
    balance: number;
    debit_counter_seen: number;
    credit_counter: number;
  };
  applied: string[];
  rejected: { idempotencyKey: string; reason: RejectedReason }[];
  chipShouldWrite: {
    balance: number;
    credit_counter: number;
  };
};

export const reconciliationApi = {
  async sync(
    eventId: string,
    wristbandUid: string,
    body: SyncRequestBody,
  ): Promise<SyncResponse> {
    const res = await api.post<SyncResponse>(
      `/events/${eventId}/wristbands/${wristbandUid}/sync`,
      body,
    );
    return res.data;
  },
};
