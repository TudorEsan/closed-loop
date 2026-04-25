import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Spinner, useThemeColor } from 'heroui-native';

import { useAuth } from '@/lib/auth-context';
import { walletsApi } from '@/lib/api/wallets';
import { extractErrorMessage } from '@/lib/api';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import { Avatar, Screen } from '@/components/ui';
import type { Transaction } from '@/types/api';

export default function HomeScreen() {
  const { session, user, isLoading: isAuthLoading } = useAuth();
  const mutedColor = useThemeColor('muted');

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletsApi.getMyWallet(),
    enabled: !!session,
    retry: false,
  });

  const txQuery = useQuery({
    queryKey: ['transactions'],
    queryFn: () => walletsApi.listMyTransactions({ limit: 10 }),
    enabled: !!session,
    retry: false,
  });

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/login" />;

  const displayName = user?.name || user?.email || 'You';

  const walletError = walletQuery.error
    ? extractErrorMessage(walletQuery.error)
    : null;
  const txError = txQuery.error ? extractErrorMessage(txQuery.error) : null;

  const transactions: Transaction[] = (txQuery.data?.transactions ?? []).filter(
    (tx) => tx.type === 'payment',
  );

  async function handleRefresh() {
    await Promise.all([walletQuery.refetch(), txQuery.refetch()]);
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={walletQuery.isFetching || txQuery.isFetching}
            onRefresh={handleRefresh}
          />
        }
      >
        <View className="px-5 pt-2">
          <View className="mb-8 flex-row items-center justify-between">
            <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
              <Avatar fallback={displayName} size={40} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/profile')}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary"
            >
              <Ionicons name="settings-outline" size={18} color="#0a0a0a" />
            </Pressable>
          </View>

          <Text className="text-[13px] font-medium text-muted">
            Total balance
          </Text>
          <View className="mt-2 flex-row items-baseline">
            {walletQuery.isLoading ? (
              <Spinner color={mutedColor} />
            ) : (
              <Text className="text-[44px] font-bold tracking-tight text-foreground">
                {walletError ? '—' : formatMoney(walletQuery.data?.balance ?? 0)}
              </Text>
            )}
          </View>

          <View className="mt-6 flex-row gap-3">
            <Button
              onPress={() => router.push('/topup')}
              size="lg"
              className="flex-1 rounded-full bg-foreground"
            >
              <Button.Label className="text-white">Add funds</Button.Label>
            </Button>
            <Button
              onPress={() => router.push('/transactions')}
              variant="secondary"
              size="lg"
              className="flex-1 rounded-full bg-surface-secondary"
            >
              <Button.Label className="text-foreground">History</Button.Label>
            </Button>
          </View>

          {walletError ? (
            <Text className="mt-4 text-[13px] text-danger">
              Could not load your balance. {walletError}
            </Text>
          ) : null}

          <View className="mt-10 mb-3 flex-row items-center justify-between">
            <Text className="text-[17px] font-semibold text-foreground">
              Transactions
            </Text>
            <Pressable
              onPress={() => router.push('/transactions')}
              hitSlop={6}
            >
              <Text className="text-[14px] font-medium text-muted">
                See all
              </Text>
            </Pressable>
          </View>

          {txQuery.isLoading ? (
            <View className="items-center py-8">
              <Spinner color={mutedColor} />
            </View>
          ) : txError ? (
            <Card variant="secondary">
              <Card.Body>
                <Card.Description className="text-danger">
                  Could not load transactions. {txError}
                </Card.Description>
              </Card.Body>
            </Card>
          ) : transactions.length === 0 ? (
            <EmptyState />
          ) : (
            <View className="gap-2">
              {transactions.slice(0, 6).map((tx) => (
                <TxRow
                  key={tx.id}
                  title={transactionTitle(tx)}
                  time={formatRelativeTime(tx.serverTimestamp)}
                  amount={formatMoney(tx.amount)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function TxRow({
  title,
  time,
  amount,
}: {
  title: string;
  time: string;
  amount: string;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface px-3 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name="card-outline" size={18} color="#0a0a0a" />
      </View>
      <View className="flex-1">
        <Text
          className="text-[15px] font-medium text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
          {time}
        </Text>
      </View>
      <Text className="text-[15px] font-semibold text-foreground">
        {amount}
      </Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="items-center rounded-2xl bg-surface px-6 py-10">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name="receipt-outline" size={22} color="#0a0a0a" />
      </View>
      <Text className="text-[15px] font-semibold text-foreground">
        No transactions yet
      </Text>
      <Text className="mt-1 text-center text-[13px] text-muted">
        Your payments will appear here once you start spending.
      </Text>
    </View>
  );
}

function transactionTitle(tx: Transaction): string {
  const meta = tx.metadata as { vendorName?: string } | null;
  return meta?.vendorName ?? 'Payment';
}
