import {
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spinner, useThemeColor } from 'heroui-native';

import { extractErrorMessage } from '@/lib/api';
import { LiquidButton, Screen } from '@/components/ui';
import { useRecentTransactions, useWallet } from '@/hooks';
import type { Transaction } from '@/types/api';

const CURRENCIES_IMAGE = require('@/assets/background.png');

export default function HomeScreen() {
  const mutedColor = useThemeColor('muted');

  const walletQuery = useWallet();
  const txQuery = useRecentTransactions(10);

  const walletError = walletQuery.error
    ? extractErrorMessage(walletQuery.error)
    : null;
  const txError = txQuery.error ? extractErrorMessage(txQuery.error) : null;

  const transactions: Transaction[] = txQuery.data?.transactions ?? [];

  async function handleRefresh() {
    await Promise.all([walletQuery.refetch(), txQuery.refetch()]);
  }

  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={walletQuery.isFetching || txQuery.isFetching}
            onRefresh={handleRefresh}
          />
        }
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <View className="w-10" />
          <Text className="text-[18px] font-semibold text-foreground">
            Attendee
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => Alert.alert('Notifications', 'Coming soon.')}
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="notifications-outline" size={22} color="#0a0a0a" />
          </Pressable>
        </View>

        <View className="px-5">
          <ImageBackground
            source={CURRENCIES_IMAGE}
            resizeMode="cover"
            imageStyle={{ borderRadius: 28 }}
            className="overflow-hidden rounded-[28px] border border-white h-52"
          >
            <View className="px-6 py-8 items-center">
              <Text className="text-white/85 text-[14px] font-medium">
                Global Balance
              </Text>
              <View className="mt-2 h-[48px] flex-row items-center">
                {walletQuery.isLoading ? (
                  <Spinner color="#ffffff" />
                ) : (
                  <Text className="text-white text-[40px] font-bold tracking-tight">
                    {walletError
                      ? '—'
                      : formatBalance(walletQuery.data?.balance ?? 0)}
                  </Text>
                )}
              </View>

              <View className="mt-5">
                <LiquidButton onPress={() => router.push('/topup')}>
                  Top-up
                </LiquidButton>
              </View>
            </View>
          </ImageBackground>

          {walletError ? (
            <Text className="mt-4 text-[13px] text-danger">
              Could not load your balance. {walletError}
            </Text>
          ) : null}

          <View className="mt-8 mb-3 flex-row items-center justify-between">
            <Text className="text-[20px] font-semibold text-foreground">
              Recent activity
            </Text>
            <Pressable
              onPress={() => router.push('/transactions')}
              hitSlop={6}
            >
              <Text className="text-[14px] font-medium text-[#7c3aed]">
                View all
              </Text>
            </Pressable>
          </View>

          {txQuery.isLoading ? (
            <View className="items-center py-8">
              <Spinner color={mutedColor} />
            </View>
          ) : txError ? (
            <Text className="text-[13px] text-danger">
              Could not load transactions. {txError}
            </Text>
          ) : transactions.length === 0 ? (
            <EmptyState />
          ) : (
            <View>
              {transactions.slice(0, 6).map((tx, idx) => (
                <View key={tx.id}>
                  <ActivityRow tx={tx} />
                  {idx < Math.min(transactions.length, 6) - 1 ? (
                    <View className="h-px bg-separator ml-[60px]" />
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

type IconStyle = {
  bg: string;
  fg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function iconStyleFor(tx: Transaction): IconStyle {
  if (tx.type === 'topup_cash' || tx.type === 'topup_online') {
    return { bg: '#16a34a', fg: '#ffffff', icon: 'add' };
  }
  if (tx.type === 'refund') {
    return { bg: '#16a34a', fg: '#ffffff', icon: 'return-up-back' };
  }
  // Deterministic color per vendor so payments alternate naturally.
  const meta = tx.metadata as { vendorName?: string } | null;
  const seed = (meta?.vendorName ?? tx.id).charCodeAt(0) % 2;
  const palette: IconStyle = seed === 0
    ? { bg: '#16a34a', fg: '#ffffff', icon: 'beer-outline' }
    : { bg: '#7c3aed', fg: '#ffffff', icon: 'bag-handle-outline' };
  return palette;
}

function ActivityRow({ tx }: { tx: Transaction }) {
  const style = iconStyleFor(tx);
  const title = activityTitle(tx);
  const subtitle = activitySubtitle(tx);
  const isCredit = tx.type !== 'payment';
  const amountText = `${isCredit ? '+' : '-'}${formatBalance(Math.abs(tx.amount))}`;
  const timeText = formatTimestamp(tx.serverTimestamp);

  return (
    <View className="flex-row items-center gap-3 py-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: style.bg }}
      >
        <Ionicons name={style.icon} size={18} color={style.fg} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-[15px] font-semibold text-foreground">
          {amountText}
        </Text>
        <Text className="mt-0.5 text-[12px] text-muted">{timeText}</Text>
      </View>
    </View>
  );
}

function activityTitle(tx: Transaction): string {
  if (tx.type === 'topup_cash' || tx.type === 'topup_online') return 'Top-up';
  if (tx.type === 'refund') return 'Refund';
  const meta = tx.metadata as { eventName?: string; vendorName?: string } | null;
  return meta?.eventName ?? meta?.vendorName ?? 'Payment';
}

function activitySubtitle(tx: Transaction): string {
  if (tx.type === 'topup_cash') return 'Cash top-up';
  if (tx.type === 'topup_online') return 'Online top-up';
  if (tx.type === 'refund') return 'Refund';
  const meta = tx.metadata as { vendorName?: string; category?: string } | null;
  return meta?.category ?? meta?.vendorName ?? 'Payment';
}

function formatBalance(minor: number): string {
  const major = minor / 100;
  const hasDecimals = Math.round(major * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major);
  return `${formatted} RON`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  const dateLabel = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return `${dateLabel}, ${time}`;
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
