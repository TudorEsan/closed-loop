import {
  ImageBackground,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spinner, useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';

import { extractErrorMessage } from '@/lib/api';
import { transactionsApi } from '@/lib/api/transactions';
import {
  ActivityRow,
  BLUR_HEADER_HEIGHT,
  BlurHeader,
  Screen,
} from '@/components/ui';
import { ScopeBadge, ScopeChip } from '@/components/scope/scope-chip';
import type { Transaction, VendorMembership } from '@/types/api';

const HERO_IMAGE = require('@/assets/background.png');

export function VendorHome({ vendor }: { vendor: VendorMembership }) {
  const mutedColor = useThemeColor('muted');

  const txQuery = useQuery({
    queryKey: ['vendor-tx', vendor.eventId, vendor.vendorId],
    queryFn: () =>
      transactionsApi.listForVendor(vendor.eventId, vendor.vendorId, {
        limit: 20,
      }),
    staleTime: 30 * 1000,
  });

  const txError = txQuery.error ? extractErrorMessage(txQuery.error) : null;
  const transactions = txQuery.data?.transactions ?? [];
  const today = filterToday(transactions);
  const totalToday = today.reduce((sum, tx) => sum + tx.amount, 0);
  const countToday = today.length;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const roleLabel =
    vendor.role === 'owner'
      ? 'Owner'
      : vendor.role === 'manager'
        ? 'Manager'
        : 'Cashier';

  const isReady = vendor.status === 'approved';

  return (
    <Screen edgeTop={false} edgeBottom={false}>
      <Animated.ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        scrollIndicatorInsets={{ top: BLUR_HEADER_HEIGHT }}
        refreshControl={
          <RefreshControl
            refreshing={txQuery.isFetching}
            onRefresh={() => txQuery.refetch()}
            progressViewOffset={BLUR_HEADER_HEIGHT}
          />
        }
      >
        <View style={{ height: BLUR_HEADER_HEIGHT }} />

        <View className="px-5">
          <ImageBackground
            source={HERO_IMAGE}
            resizeMode="cover"
            imageStyle={{ borderRadius: 24 }}
            className="overflow-hidden rounded-3xl border border-white"
          >
            <View className="px-6 py-7 gap-3">
              <ScopeBadge label={roleLabel} tone="accent" />
              <Text
                className="text-2xl font-bold text-foreground"
                numberOfLines={1}
              >
                {vendor.businessName}
              </Text>
              <Text className="text-xs text-muted">{vendor.eventName}</Text>
              <View className="mt-2">
                <Text className="text-xs text-muted">Today&apos;s sales</Text>
                <Text className="mt-1 text-4xl font-bold tracking-tight text-foreground">
                  {formatBalance(totalToday)}
                </Text>
                <Text className="mt-1 text-xs text-muted">
                  {countToday} {countToday === 1 ? 'charge' : 'charges'} so far
                </Text>
              </View>
            </View>
          </ImageBackground>

          {!isReady ? (
            <View className="mt-4 rounded-2xl bg-surface px-4 py-3">
              <Text className="text-xs text-muted">
                Vendor status: {vendor.status}. Charging is available once the
                organizer approves your stand.
              </Text>
            </View>
          ) : null}

          <View className="mt-6">
            <Pressable
              onPress={() => router.push('/charge')}
              disabled={!isReady}
              className="rounded-2xl bg-foreground px-6 py-6 flex-row items-center justify-between"
              style={{ opacity: isReady ? 1 : 0.5 }}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-background">
                  <Ionicons name="card-outline" size={22} color="#0a0a0a" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-background">
                    New charge
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted">
                    Enter amount, tap a wristband
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
            </Pressable>
          </View>

          <View className="mt-8 mb-3 flex-row items-center justify-between">
            <Text className="text-xl font-semibold text-foreground">
              Recent activity
            </Text>
          </View>

          {txQuery.isLoading ? (
            <View className="items-center py-8">
              <Spinner color={mutedColor} />
            </View>
          ) : txError ? (
            <Text className="text-sm text-danger">
              Could not load transactions. {txError}
            </Text>
          ) : transactions.length === 0 ? (
            <EmptyState />
          ) : (
            <View>
              {transactions.slice(0, 6).map((tx, idx) => (
                <View key={tx.id}>
                  <ChargeRow tx={tx} />
                  {idx < Math.min(transactions.length, 6) - 1 ? (
                    <View className="h-px bg-separator ml-14" />
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <BlurHeader
        scrollY={scrollY}
        title={vendor.businessName}
        right={<ScopeChip />}
      />
    </Screen>
  );
}

function ChargeRow({ tx }: { tx: Transaction }) {
  const meta = tx.metadata as { customerName?: string } | null;
  const isRefund = tx.type === 'credit';
  return (
    <ActivityRow
      icon={isRefund ? 'return-up-back' : 'card-outline'}
      iconBg={isRefund ? '#dcfce7' : '#ede9fe'}
      iconFg={isRefund ? '#15803d' : '#7c3aed'}
      title={isRefund ? 'Refund' : 'Sale'}
      subtitle={meta?.customerName ?? formatStatus(tx.status)}
      amount={`${isRefund ? '+' : ''}${formatBalance(tx.amount)}`}
      amountTone={isRefund ? 'success' : 'default'}
      time={formatTime(tx.serverTimestamp)}
    />
  );
}

function EmptyState() {
  return (
    <View className="items-center rounded-2xl bg-surface px-6 py-10">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name="card-outline" size={22} color="#0a0a0a" />
      </View>
      <Text className="text-base font-semibold text-foreground">
        No charges yet
      </Text>
      <Text className="mt-1 text-center text-sm text-muted">
        Your sales will show up here as you charge bracelets.
      </Text>
    </View>
  );
}

function filterToday(items: Transaction[]): Transaction[] {
  const today = new Date().toDateString();
  return items.filter(
    (tx) =>
      tx.type === 'debit' &&
      new Date(tx.serverTimestamp).toDateString() === today,
  );
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

function formatStatus(status: string): string {
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  if (status === 'flagged') return 'Flagged';
  return 'Completed';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
