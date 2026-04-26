import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStripe } from '@stripe/stripe-react-native';

import { paymentsApi } from '@/lib/api/payments';
import {
  FULL_TRANSACTIONS_QUERY_KEY,
  RECENT_TRANSACTIONS_QUERY_KEY,
} from './use-transactions';
import { MY_BRACELETS_QUERY_KEY } from './use-my-bracelets';

export const TOPUP_CANCELED = 'CANCELED';

type TopUpOptions = {
  onSuccess?: () => void;
  onCanceled?: () => void;
  onError?: (err: unknown) => void;
};

type TopUpInput = { eventBraceletId: string; amountCents: number };

type TopUpResult =
  | { canceled: true }
  | {
      canceled: false;
      intent: Awaited<ReturnType<typeof paymentsApi.createTopupIntent>>;
    };

// Topup flow has two phases packed into one mutation:
// 1. ask the backend to create a payment intent for a specific bracelet
// 2. open the payment sheet with that intent
// The bracelet balance gets credited by the backend webhook, so when the
// sheet returns we just refetch to see the new balance.
// Cancel is handled as a normal resolved result, not an error, so the
// mutation goes back to idle and the button does not stay stuck loading.
export function useTopUp({ onSuccess, onCanceled, onError }: TopUpOptions = {}) {
  const qc = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return useMutation<TopUpResult, Error, TopUpInput>({
    mutationFn: async ({ eventBraceletId, amountCents }) => {
      if (!eventBraceletId) {
        throw new Error('Pick a bracelet first');
      }
      if (!amountCents || amountCents <= 0) {
        throw new Error('Enter an amount first');
      }

      const intent = await paymentsApi.createTopupIntent({
        eventBraceletId,
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
          return { canceled: true };
        }
        throw new Error(sheetRes.error.message);
      }

      return { canceled: false, intent };
    },
    onSuccess: (result) => {
      if (result.canceled) {
        onCanceled?.();
        return;
      }
      qc.invalidateQueries({ queryKey: MY_BRACELETS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: RECENT_TRANSACTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: FULL_TRANSACTIONS_QUERY_KEY });
      onSuccess?.();
    },
    onError,
  });
}
