import { api } from '../api';

export type TopupIntentResponse = {
  paymentIntentId: string;
  clientSecret: string;
  publishableKey: string;
  provider: string;
  currency: string;
  amount: number;
};

// Topup intent is now scoped to a specific bracelet (one per event), since
// the wallets table is gone and balance lives on event_bracelets.
export const paymentsApi = {
  async createTopupIntent(
    body: { eventBraceletId: string; amount: number },
  ): Promise<TopupIntentResponse> {
    const res = await api.post<TopupIntentResponse>(
      `/bracelets/topup/intent`,
      body,
    );
    return res.data;
  },
};
