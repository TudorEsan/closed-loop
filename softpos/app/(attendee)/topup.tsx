import { useCallback, useEffect, useState } from 'react';
import {
  Alert as RNAlert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Spinner,
  TextField,
} from 'heroui-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { walletsApi } from '@/lib/api/wallets';
import { extractErrorMessage } from '@/lib/api';
import { sessionStore } from '@/lib/storage';
import { formatMoney } from '@/lib/format';

type PayMethod = 'card' | 'cash';

const QUICK_AMOUNTS = [10, 20, 50, 100];

export default function TopUpScreen() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('card');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const id = await sessionStore.getSelectedEvent();
        if (active) {
          setEventId(id);
          setReady(true);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const topUpMutation = useMutation({
    mutationFn: async (payload: { amount: number; method: PayMethod }) => {
      if (!eventId) throw new Error('No event selected');
      return walletsApi.topUp(eventId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', eventId] });
      queryClient.invalidateQueries({ queryKey: ['wallet-tx-preview', eventId] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions', eventId] });
      RNAlert.alert('Success', 'Your top up was added to your wallet.');
      setAmount('');
      router.push('/(attendee)');
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
    },
  });

  // Clear error whenever the user types again
  useEffect(() => {
    if (error) setError(null);
  }, [amount, method]);

  function handleQuickAmount(value: number) {
    setAmount(String(value));
  }

  function handleConfirm() {
    const parsed = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (parsed > 1000) {
      setError('Max is 1000 EUR per top up');
      return;
    }
    const minor = Math.round(parsed * 100);
    topUpMutation.mutate({ amount: minor, method });
  }

  if (!ready) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Spinner />
      </SafeAreaView>
    );
  }

  if (!eventId) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 px-6 justify-center gap-4">
          <Label className="text-2xl font-bold text-foreground">
            Pick an event first
          </Label>
          <Description>
            You need to choose an event before you can top up.
          </Description>
          <Button onPress={() => router.push('/(attendee)/select-event')}>
            Pick an event
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const parsedAmount = Number(amount.replace(',', '.'));
  const previewValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            gap: 20,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Label className="text-2xl font-bold text-foreground">
              Add money
            </Label>
            <Description>
              Pick a quick amount or type your own. No stress.
            </Description>
          </View>

          <Card className="p-5">
            <Card.Body className="gap-4">
              <Label className="text-base font-medium text-foreground">
                Quick amounts
              </Label>
              <View className="flex-row flex-wrap gap-2">
                {QUICK_AMOUNTS.map((value) => {
                  const isActive = amount === String(value);
                  return (
                    <Chip
                      key={value}
                      variant={isActive ? 'primary' : 'secondary'}
                      color={isActive ? 'accent' : 'default'}
                      onPress={() => handleQuickAmount(value)}
                    >
                      <Chip.Label>{formatMoney(value * 100)}</Chip.Label>
                    </Chip>
                  );
                })}
              </View>

              <TextField>
                <Label>Custom amount (EUR)</Label>
                <Input
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g. 25"
                  keyboardType="decimal-pad"
                />
              </TextField>
            </Card.Body>
          </Card>

          <Card className="p-5">
            <Card.Body className="gap-3">
              <Label className="text-base font-medium text-foreground">
                Payment method
              </Label>
              <View className="flex-row gap-2">
                <Chip
                  variant={method === 'card' ? 'primary' : 'secondary'}
                  color={method === 'card' ? 'accent' : 'default'}
                  onPress={() => setMethod('card')}
                >
                  <Chip.Label>Card</Chip.Label>
                </Chip>
                <Chip
                  variant={method === 'cash' ? 'primary' : 'secondary'}
                  color={method === 'cash' ? 'accent' : 'default'}
                  onPress={() => setMethod('cash')}
                >
                  <Chip.Label>Cash</Chip.Label>
                </Chip>
              </View>
              <Description>
                {method === 'card'
                  ? 'You will pay by card at the register.'
                  : 'You will pay cash at the register.'}
              </Description>
            </Card.Body>
          </Card>

          {error ? (
            <Description className="text-danger">{error}</Description>
          ) : null}

          <Button
            onPress={handleConfirm}
            isDisabled={topUpMutation.isPending || !previewValid}
          >
            {topUpMutation.isPending ? (
              <Spinner />
            ) : previewValid ? (
              `Confirm top up of ${formatMoney(Math.round(parsedAmount * 100))}`
            ) : (
              'Confirm top up'
            )}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
