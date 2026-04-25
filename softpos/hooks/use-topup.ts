import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStripe } from '@stripe/stripe-react-native';

import { paymentsApi } from '@/lib/api/payments';
import {
  FULL_TRANSACTIONS_QUERY_KEY,
  RECENT_TRANSACTIONS_QUERY_KEY,
} from './use-transactions';
import { WALLET_QUERY_KEY } from './use-wallet';

export const TOPUP_CANCELED = 'CANCELED';

type TopUpOptions = {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
};

// Topup flow has two phases packed into one mutation:
// 1. ask the backend to create a payment intent
// 2. open the payment sheet with that intent
// The wallet gets credited by the backend webhook, so when the sheet
// returns we just refetch the wallet to see the new balance.
export function useTopUp({ onSuccess, onError }: TopUpOptions = {}) {
  const qc = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return useMutation({
    mutationFn: async (amountCents: number) => {
      if (!amountCents || amountCents <= 0) {
        throw new Error('Enter an amount first');
      }

      const intent = await paymentsApi.createTopupIntent({
        amount: amountCents,
      });

      const initRes = await initPaymentSheet({
        merchantDisplayName: 'SoftPOS Festival',
        paymentIntentClientSecret: intent.clientSecret,
      });
      if (initRes.error) throw new Error(initRes.error.message);

      const sheetRes = await presentPaymentSheet();
      if (sheetRes.error) {
        if (sheetRes.error.code === 'Canceled') {
          throw new Error(TOPUP_CANCELED);
        }
        throw new Error(sheetRes.error.message);
      }

      return intent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
      qc.invalidateQueries({ queryKey: RECENT_TRANSACTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: FULL_TRANSACTIONS_QUERY_KEY });
      onSuccess?.();
    },
    onError,
  });
}
