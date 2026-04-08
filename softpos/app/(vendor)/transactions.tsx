import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Description,
  Label,
  Spinner,
} from 'heroui-native';
import { useInfiniteQuery } from '@tanstack/react-query';

import { sessionStore } from '@/lib/storage';
import { transactionsApi } from '@/lib/api/transactions';
import { extractErrorMessage } from '@/lib/api';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import type { Transaction, TransactionStatus } from '@/types/api';

function statusColor(
  s: TransactionStatus,
): 'default' | 'success' | 'warning' | 'danger' {
  switch (s) {
    case 'completed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
    case 'reversed':
      return 'danger';
    default:
      return 'default';
  }
}

function shortUid(uid: string | null | undefined): string {
  if (!uid) return '------';
  return uid.slice(-6).toUpperCase();
}

export default function VendorTransactionsScreen() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [ctxReady, setCtxReady] = useState(false);

  useEffect(() => {
    (async () => {
      const e = await sessionStore.getSelectedEvent();
      const v = await sessionStore.getSelectedVendor();
      setEventId(e);
      setVendorId(v);
      setCtxReady(true);
    })();
  }, []);

  const query = useInfiniteQuery({
    enabled: !!eventId && !!vendorId,
    queryKey: ['vendor-transactions', eventId, vendorId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      transactionsApi.listForVendor(eventId as string, vendorId as string, {
        limit: 20,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor ?? (undefined as string | undefined),
  });

  if (!ctxReady) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  if (!eventId || !vendorId) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <Label className="text-xl font-semibold">Setup missing</Label>
          <Button onPress={() => router.replace('/(vendor)/setup')}>
            Go to setup
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const rows = (query.data?.pages ?? []).flatMap((p) => p.transactions);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <Label className="text-2xl font-bold text-foreground">
          Transactions
        </Label>
        <Button variant="ghost" onPress={() => router.back()}>
          Back
        </Button>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : query.error ? (
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <Label className="text-base text-danger font-semibold">
            Could not load transactions
          </Label>
          <Description className="text-center">
            {extractErrorMessage(query.error)}
          </Description>
          <Button onPress={() => query.refetch()}>Try again</Button>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          contentContainerClassName="px-6 pb-10 gap-3"
          renderItem={({ item }) => <TransactionRow tx={item} />}
          ListEmptyComponent={
            <View className="items-center mt-10">
              <Description>Nothing here yet. Take a payment.</Description>
            </View>
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4 items-center">
                <Spinner />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => query.refetch()}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  const uid = typeof meta.wristbandUid === 'string' ? meta.wristbandUid : null;
  const operator =
    typeof meta.operatorName === 'string'
      ? meta.operatorName
      : (tx.operatorId ?? 'unknown');

  return (
    <Card>
      <Card.Body className="gap-1">
        <View className="flex-row justify-between items-center">
          <Label className="text-lg font-semibold text-foreground">
            {formatMoney(tx.amount)}
          </Label>
          <Chip size="sm" variant="soft" color={statusColor(tx.status)}>
            <Chip.Label>{tx.status}</Chip.Label>
          </Chip>
        </View>
        <View className="flex-row justify-between">
          <Description>Wristband {shortUid(uid)}</Description>
          <Description>{formatRelativeTime(tx.serverTimestamp)}</Description>
        </View>
        <Description>Operator {String(operator).slice(0, 16)}</Description>
      </Card.Body>
    </Card>
  );
}
