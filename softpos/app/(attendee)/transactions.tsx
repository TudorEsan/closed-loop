import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Description, Label, Separator, Spinner } from 'heroui-native';
import { useInfiniteQuery } from '@tanstack/react-query';

import { walletsApi } from '@/lib/api/wallets';
import { extractErrorMessage } from '@/lib/api';
import { sessionStore } from '@/lib/storage';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import type { Transaction } from '@/types/api';

export default function TransactionsScreen() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

  const query = useInfiniteQuery({
    queryKey: ['wallet-transactions', eventId],
    enabled: !!eventId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      walletsApi.listMyTransactions(eventId as string, {
        limit: 20,
        cursor: pageParam,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

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
            No event picked
          </Label>
          <Description>
            Pick an event first to see your transactions.
          </Description>
          <Button onPress={() => router.push('/(attendee)/select-event')}>
            Pick an event
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const items: Transaction[] =
    query.data?.pages.flatMap((p) => p.transactions) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4 pb-2">
        <Label className="text-2xl font-bold text-foreground">History</Label>
        <Description>All your moves in one place.</Description>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <Description className="text-danger">
            {extractErrorMessage(query.error)}
          </Description>
          <Button variant="secondary" onPress={() => query.refetch()}>
            Try again
          </Button>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <Separator />}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => query.refetch()}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-6 gap-2">
              <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
              <Label className="text-base font-medium text-foreground">
                No transactions yet
              </Label>
              <Description>Top up your wallet to get things rolling.</Description>
            </View>
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4 items-center">
                <Spinner />
              </View>
            ) : null
          }
          renderItem={({ item }) => <TransactionRow tx={item} />}
        />
      )}
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
    tx.metadata && typeof tx.metadata === 'object'
      ? (tx.metadata as Record<string, unknown>).vendorName
      : undefined;

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
    <View className="flex-row items-center gap-3 px-5 py-4 bg-background">
      <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
        <Ionicons name={iconName} size={20} color="#2563eb" />
      </View>
      <View className="flex-1">
        <Label className="text-base font-medium text-foreground">
          {label}
        </Label>
        <Description>
          {formatRelativeTime(tx.serverTimestamp)}
          {tx.status !== 'completed' ? `  ${tx.status}` : ''}
        </Description>
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
