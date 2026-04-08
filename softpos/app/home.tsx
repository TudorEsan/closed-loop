import { useMemo } from 'react';
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { walletsApi } from '@/lib/api/wallets';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import {
  ActionPill,
  Avatar,
  BalanceCard,
  Screen,
  SectionHeader,
  SurfaceCard,
  TransactionRow,
} from '@/components/ui';
import type { Transaction } from '@/types/api';

// Sample rows so the UI still looks alive while the backend has nothing.
const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: 's1',
    eventId: null,
    walletId: 'sample',
    vendorId: null,
    deviceId: null,
    operatorId: null,
    type: 'payment',
    amount: 1200,
    status: 'completed',
    offline: false,
    serverTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    metadata: { vendorName: 'Food truck' },
  },
  {
    id: 's2',
    eventId: null,
    walletId: 'sample',
    vendorId: null,
    deviceId: null,
    operatorId: null,
    type: 'payment',
    amount: 800,
    status: 'completed',
    offline: false,
    serverTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    metadata: { vendorName: 'Bar stage 2' },
  },
  {
    id: 's3',
    eventId: null,
    walletId: 'sample',
    vendorId: null,
    deviceId: null,
    operatorId: null,
    type: 'payment',
    amount: 450,
    status: 'completed',
    offline: false,
    serverTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    metadata: { vendorName: 'Merch' },
  },
  {
    id: 's4',
    eventId: null,
    walletId: 'sample',
    vendorId: null,
    deviceId: null,
    operatorId: null,
    type: 'payment',
    amount: 2000,
    status: 'completed',
    offline: false,
    serverTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    metadata: { vendorName: 'Main stage bar' },
  },
];

export default function HomeScreen() {
  const { session, user, isLoading: isAuthLoading } = useAuth();

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletsApi.getMyWallet(),
    enabled: !!session,
  });

  const txQuery = useQuery({
    queryKey: ['transactions'],
    queryFn: () => walletsApi.listMyTransactions({ limit: 10 }),
    enabled: !!session,
  });

  const transactionsToShow: Transaction[] = useMemo(() => {
    const real = (txQuery.data?.transactions ?? []).filter(
      (tx) => tx.type === 'payment',
    );
    if (real.length > 0) return real.slice(0, 4);
    return SAMPLE_TRANSACTIONS;
  }, [txQuery.data]);

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/login" />;

  const balanceCents = walletQuery.data?.balance ?? 0;
  const fallbackBalance = walletQuery.data ? balanceCents : 1917646;
  const displayName = user?.name || user?.email || 'You';

  async function handleRefresh() {
    await Promise.all([walletQuery.refetch(), txQuery.refetch()]);
  }

  return (
    <ImageBackground
      source={require('../assets/background.png')}
      resizeMode="cover"
      className="flex-1"
    >
      <Screen>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={walletQuery.isFetching || txQuery.isFetching}
              onRefresh={handleRefresh}
              tintColor="#ffffff"
            />
          }
        >
          <View className="px-5 pb-10">
          <View className="mb-4 mt-2 flex-row items-center">
            <Pressable onPress={() => router.push('/profile')}>
              <Avatar
                fallback={displayName}
                size={44}
                borderColor="rgba(255,255,255,0.6)"
              />
            </Pressable>
          </View>

          <Text className="mb-4 ml-1 text-2xl font-semibold text-white">
            Dashboard
          </Text>

          <BalanceCard amount={formatMoney(fallbackBalance)}>
            <ActionPill
              label="Add funds"
              onPress={() => router.push('/topup')}
            />
          </BalanceCard>

          <View className="mt-5">
            <SurfaceCard>
              <SectionHeader
                title="Transactions"
                actionLabel="See all"
                onActionPress={() => router.push('/transactions')}
              />
              <View className="gap-2">
                {transactionsToShow.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    title={transactionTitle(tx)}
                    time={formatRelativeTime(tx.serverTimestamp)}
                    amount={formatMoney(tx.amount)}
                  />
                ))}
              </View>
            </SurfaceCard>
          </View>
          </View>
        </ScrollView>
      </Screen>
    </ImageBackground>
  );
}

function transactionTitle(tx: Transaction): string {
  const meta = tx.metadata as { vendorName?: string } | null;
  return meta?.vendorName ?? 'Payment';
}
