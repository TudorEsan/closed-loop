import { FlatList, RefreshControl, Text, View } from 'react-native';

import { Screen, SurfaceCard, TransactionRow } from '@/components/ui';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import { useTransactionsInfinite } from '@/hooks';
import type { Transaction } from '@/types/api';

export default function TransactionsScreen() {
  const query = useTransactionsInfinite(20);

  const items: Transaction[] = (
    query.data?.pages.flatMap((p) => p.transactions) ?? []
  ).filter((tx) => tx.type === 'debit');

  return (
    <Screen edgeTop={false}>
      <View className="flex-1 bg-app-bg">
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 8 }}
          data={items}
          keyExtractor={(tx) => tx.id}
          renderItem={({ item }) => (
            <TransactionRow
              title={titleOf(item)}
              time={formatRelativeTime(item.serverTimestamp)}
              amount={formatMoney(item.amount)}
            />
          )}
          ItemSeparatorComponent={null}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
            />
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            !query.isLoading ? (
              <SurfaceCard>
                <Text className="text-center text-[15px] text-app-muted">
                  No transactions yet
                </Text>
              </SurfaceCard>
            ) : null
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="items-center py-3">
                <Text className="text-xs text-app-muted">Loading more...</Text>
              </View>
            ) : null
          }
        />
      </View>
    </Screen>
  );
}

function titleOf(tx: Transaction): string {
  const meta = tx.metadata as { vendorName?: string } | null;
  return meta?.vendorName ?? 'Payment';
}
