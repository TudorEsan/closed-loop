import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Description,
  Label,
  Separator,
  Spinner,
} from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { eventsApi } from '@/lib/api/events';
import { walletsApi } from '@/lib/api/wallets';
import { extractErrorMessage } from '@/lib/api';
import { sessionStore } from '@/lib/storage';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import type { Transaction } from '@/types/api';

export default function WalletScreen() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventLoaded, setEventLoaded] = useState(false);
  const queryClient = useQueryClient();

  // Reload the selected event every time the screen comes into focus, so if
  // the user picks one from the select screen we catch it.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const id = await sessionStore.getSelectedEvent();
        if (active) {
          setEventId(id);
          setEventLoaded(true);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.get(eventId as string),
    enabled: !!eventId,
  });

  const walletQuery = useQuery({
    queryKey: ['wallet', eventId],
    queryFn: () => walletsApi.getMyWallet(eventId as string),
    enabled: !!eventId,
  });

  const txQuery = useQuery({
    queryKey: ['wallet-tx-preview', eventId],
    queryFn: () =>
      walletsApi.listMyTransactions(eventId as string, { limit: 3 }),
    enabled: !!eventId,
  });

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wallet', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['wallet-tx-preview', eventId] }),
    ]);
  }

  const isRefreshing =
    walletQuery.isFetching || eventQuery.isFetching || txQuery.isFetching;

  if (!eventLoaded) {
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
            No event picked yet
          </Label>
          <Description>
            You need to choose an event before you can see your wallet.
          </Description>
          <Button onPress={() => router.push('/(attendee)/select-event')}>
            Pick an event
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const wallet = walletQuery.data;
  const event = eventQuery.data;
  const transactions = txQuery.data?.transactions ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 20,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="gap-1">
          <Label className="text-2xl font-bold text-foreground">
            Hey there
          </Label>
          <Description>Welcome back to your festival wallet.</Description>
        </View>

        <Card className="p-5">
          <Card.Body className="gap-3">
            <Description className="text-muted-foreground">
              Current balance
            </Description>
            {walletQuery.isLoading ? (
              <Spinner />
            ) : walletQuery.isError ? (
              <Description className="text-danger">
                {extractErrorMessage(walletQuery.error)}
              </Description>
            ) : !wallet ? (
              <>
                <Label className="text-4xl font-bold text-foreground">
                  {formatMoney(0)}
                </Label>
                <Description>
                  You don't have a wallet for this event yet. Top up to get
                  started.
                </Description>
              </>
            ) : (
              <>
                <Label className="text-4xl font-bold text-foreground">
                  {formatMoney(wallet.balance)}
                </Label>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Description>
                    {event?.name ?? 'Loading event...'}
                  </Description>
                </View>
                {wallet.wristbandUid ? (
                  <View className="flex-row items-center gap-2 mt-1">
                    <Ionicons name="radio-outline" size={16} color="#6b7280" />
                    <Description>
                      Wristband: {wallet.wristbandUid}
                    </Description>
                  </View>
                ) : (
                  <Description className="mt-1">
                    No wristband linked yet
                  </Description>
                )}
              </>
            )}
          </Card.Body>
          <Card.Footer className="mt-4">
            <Button
              className="w-full"
              onPress={() => router.push('/(attendee)/topup')}
            >
              Top up
            </Button>
          </Card.Footer>
        </Card>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Label className="text-lg font-semibold text-foreground">
              Recent activity
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(attendee)/transactions')}
            >
              See all
            </Button>
          </View>

          <Card className="p-0">
            <Card.Body className="p-0">
              {txQuery.isLoading ? (
                <View className="p-6 items-center">
                  <Spinner />
                </View>
              ) : txQuery.isError ? (
                <View className="p-4">
                  <Description className="text-danger">
                    {extractErrorMessage(txQuery.error)}
                  </Description>
                </View>
              ) : transactions.length === 0 ? (
                <View className="p-6 items-center">
                  <Description>Nothing here yet, go spend some money</Description>
                </View>
              ) : (
                transactions.map((tx, idx) => (
                  <View key={tx.id}>
                    <TransactionRow tx={tx} />
                    {idx < transactions.length - 1 ? <Separator /> : null}
                  </View>
                ))
              )}
            </Card.Body>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.type === 'topup' || tx.type === 'refund';
  const sign = isCredit ? '+' : '-';
  const iconName: keyof typeof Ionicons.glyphMap =
    tx.type === 'topup'
      ? 'arrow-down-circle-outline'
      : tx.type === 'refund'
        ? 'return-down-back-outline'
        : tx.type === 'payment'
          ? 'cart-outline'
          : 'swap-horizontal-outline';

  const vendorName =
    (tx.metadata && typeof tx.metadata === 'object'
      ? (tx.metadata as Record<string, unknown>).vendorName
      : undefined) ?? null;

  const label =
    tx.type === 'topup'
      ? 'Top up'
      : tx.type === 'payment'
        ? typeof vendorName === 'string' && vendorName.length > 0
          ? vendorName
          : 'Payment'
        : tx.type === 'refund'
          ? 'Refund'
          : 'Adjustment';

  return (
    <View className="flex-row items-center gap-3 p-4">
      <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
        <Ionicons name={iconName} size={20} color="#2563eb" />
      </View>
      <View className="flex-1">
        <Label className="text-base font-medium text-foreground">
          {label}
        </Label>
        <Description>{formatRelativeTime(tx.serverTimestamp)}</Description>
      </View>
      <Label
        className={
          isCredit
            ? 'text-base font-semibold text-primary'
            : 'text-base font-semibold text-foreground'
        }
      >
        {sign}
        {formatMoney(tx.amount)}
      </Label>
    </View>
  );
}
