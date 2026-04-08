import { api } from '../api';

export type TopupIntentResponse = {
  paymentIntentId: string;
  clientSecret: string;
  publishableKey: string;
  provider: string;
  currency: string;
  amount: number;
};

// Talks to the backend payments module. Provider-agnostic on purpose, the
// mobile side does not care whether stripe or something else is on the
// other end as long as the response shape stays the same.
export const paymentsApi = {
  async createTopupIntent(
    body: { amount: number },
  ): Promise<TopupIntentResponse> {
    const res = await api.post<TopupIntentResponse>(
      `/wallets/me/topup/intent`,
      body,
    );
    return res.data;
  },
};
