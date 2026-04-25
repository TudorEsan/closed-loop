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

import { extractErrorMessage } from '@/lib/api';
import { Screen } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { TOPUP_CANCELED, useTopUp } from '@/hooks';

const QUICK_AMOUNTS = [10, 20, 50, 100];

export default function TopUpScreen() {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const topUpMutation = useTopUp({
    onSuccess: () => {
      Alert.alert('Done', 'Your funds were added.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      const msg = extractErrorMessage(err);
      if (msg === TOPUP_CANCELED) {
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
              onPress={() =>
                topUpMutation.mutate(Math.round(parsedAmount * 100))
              }
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
