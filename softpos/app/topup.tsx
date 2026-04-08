import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStripe } from '@stripe/stripe-react-native';

import { paymentsApi } from '@/lib/api/payments';
import { extractErrorMessage } from '@/lib/api';
import { Screen } from '@/components/ui';
import { formatMoney } from '@/lib/format';

const QUICK_AMOUNTS = [10, 20, 50, 100];

export default function TopUpScreen() {
  const qc = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Topup flow has two phases packed into one mutation:
  // 1. ask the backend to create a payment intent
  // 2. open the payment sheet with that intent
  // The wallet gets credited by the backend webhook, so when the sheet
  // returns we just refetch the wallet to see the new balance.
  const topUpMutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(amount || '0') * 100);
      if (!cents || cents <= 0) throw new Error('Enter an amount first');

      const intent = await paymentsApi.createTopupIntent({ amount: cents });

      const initRes = await initPaymentSheet({
        merchantDisplayName: 'SoftPOS Festival',
        paymentIntentClientSecret: intent.clientSecret,
      });
      if (initRes.error) throw new Error(initRes.error.message);

      const sheetRes = await presentPaymentSheet();
      if (sheetRes.error) {
        if (sheetRes.error.code === 'Canceled') {
          throw new Error('CANCELED');
        }
        throw new Error(sheetRes.error.message);
      }

      return intent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions-full'] });
      Alert.alert('Done', 'Your funds were added.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      const msg = extractErrorMessage(err);
      if (msg === 'CANCELED') {
        setError(null);
        return;
      }
      setError(msg);
    },
  });

  const parsedAmount = parseFloat(amount || '0');
  const hasAmount = parsedAmount > 0;

  return (
    <Screen edgeTop={false}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="bg-app-bg"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-10 pb-8">
          <Text className="mb-2 text-sm text-app-muted">Amount</Text>

          <View className="mb-10 flex-row items-baseline">
            <Text className="text-[56px] font-bold text-app-fg">€</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                setError(null);
              }}
              placeholder="0"
              placeholderTextColor="#c7c7c7"
              keyboardType="decimal-pad"
              className="ml-1 flex-1 p-0 text-[56px] font-bold text-app-fg"
            />
          </View>

          <View className="mb-8 flex-row flex-wrap gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <QuickChip
                key={q}
                label={formatMoney(q * 100)}
                selected={parsedAmount === q}
                onPress={() => {
                  setAmount(String(q));
                  setError(null);
                }}
              />
            ))}
          </View>

          <View className="mb-6 rounded-2xl bg-app-surface p-5">
            <Text className="mb-1 text-xs uppercase tracking-wide text-app-muted">
              Payment method
            </Text>
            <Text className="text-[17px] font-medium text-app-fg">
              Card
            </Text>
            <Text className="mt-1 text-xs text-app-muted">
              Your card details are handled securely, we never see them.
            </Text>
          </View>

          {error ? (
            <Text className="mb-4 text-center text-sm text-app-danger">
              {error}
            </Text>
          ) : null}

          <View className="mt-auto">
            <Pressable
              onPress={() => topUpMutation.mutate()}
              disabled={!hasAmount || topUpMutation.isPending}
              className={`rounded-2xl py-4 ${
                hasAmount && !topUpMutation.isPending
                  ? 'bg-app-fg'
                  : 'bg-app-border'
              }`}
            >
              {topUpMutation.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-center text-[17px] font-semibold text-white">
                  {hasAmount
                    ? `Add ${formatMoney(Math.round(parsedAmount * 100))}`
                    : 'Add funds'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function QuickChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-5 py-2.5 ${
        selected ? 'bg-app-fg' : 'bg-app-surface'
      }`}
    >
      <Text
        className={`text-[15px] font-medium ${
          selected ? 'text-white' : 'text-app-fg'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
