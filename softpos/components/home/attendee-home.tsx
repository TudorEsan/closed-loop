import type { ReactNode } from 'react';
import {
  ImageBackground,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { extractErrorMessage } from '@/lib/api';
import {
  ActivityRow,
  BLUR_HEADER_HEIGHT,
  BlurHeader,
  Screen,
  TopupButton,
} from '@/components/ui';
import { ProfileButton, ScopeChip } from '@/components/scope/scope-chip';
import {
  useMyBracelets,
  useMyMemberships,
  useRecentTransactions,
} from '@/hooks';
import { useAuthContext } from '@/lib/auth-context';
import { formatMoney } from '@/lib/format';
import type { Transaction } from '@/types/api';
import type { MyBraceletRow } from '@/lib/api/bracelets';

const CURRENCIES_IMAGE = require('@/assets/background.png');

export function AttendeeHome() {
  const mutedColor = useThemeColor('muted');
  const insets = useSafeAreaInsets();

  const auth = useAuthContext();
  const membershipsQuery = useMyMemberships();
  const braceletsQuery = useMyBracelets();
  const txQuery = useRecentTransactions(10);

  const braceletsError = braceletsQuery.error
    ? extractErrorMessage(braceletsQuery.error)
    : null;
  const txError = txQuery.error ? extractErrorMessage(txQuery.error) : null;

  const bracelets: MyBraceletRow[] = braceletsQuery.data ?? [];
  const transactions: Transaction[] = txQuery.data?.transactions ?? [];
  const hasBracelets = bracelets.length > 0;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  async function handleRefresh() {
    await Promise.all([
      auth.refresh(),
      membershipsQuery.refetch(),
      braceletsQuery.refetch(),
      txQuery.refetch(),
    ]);
  }

  const isRefreshing =
    membershipsQuery.isFetching ||
    braceletsQuery.isFetching ||
    txQuery.isFetching;

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      progressViewOffset={BLUR_HEADER_HEIGHT}
    />
  );

  let statusContent: ReactNode = null;
  if (braceletsQuery.isLoading) {
    statusContent = <Spinner color={mutedColor} />;
  } else if (braceletsError) {
    statusContent = (
      <Text className="text-center text-sm text-danger">
        Could not load your bracelets. {braceletsError}
      </Text>
    );
  } else if (!hasBracelets) {
    statusContent = (
      <>
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface">
          <Ionicons name="ticket-outline" size={28} color="#0a0a0a" />
        </View>
        <Text className="text-xl font-semibold text-foreground">
          No festival tickets
        </Text>
        <Text className="mt-2 text-center text-sm text-muted">
          Once a festival links your bracelet at the gate, your wallet shows
          up here.
        </Text>
      </>
    );
  }

  if (statusContent !== null) {
    return (
      <Screen edgeTop={false} edgeBottom={false}>
        <Animated.ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={{ flexGrow: 1 }}
          scrollEventThrottle={16}
          onScroll={onScroll}
          scrollIndicatorInsets={{ top: BLUR_HEADER_HEIGHT }}
          refreshControl={refreshControl}
        >
          <View style={{ height: insets.top + BLUR_HEADER_HEIGHT + 8 }} />
          <View className="flex-1 items-center justify-center px-8 pb-16">
            {statusContent}
          </View>
        </Animated.ScrollView>
        <BlurHeader
          scrollY={scrollY}
          title="Wallet"
          left={<ProfileButton />}
          right={<ScopeChip />}
        />
      </Screen>
    );
  }

  return (
    <Screen edgeTop={false} edgeBottom={false}>
      <Animated.ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        scrollIndicatorInsets={{ top: BLUR_HEADER_HEIGHT }}
        refreshControl={refreshControl}
      >
        <View style={{ height: insets.top + BLUR_HEADER_HEIGHT + 8 }} />

        <View className="px-5">
          <View className="gap-4">
            {bracelets.map((bracelet) => (
              <BraceletCard key={bracelet.id} bracelet={bracelet} />
            ))}
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
            <Text className="text-xs text-danger">
              Could not load transactions. {txError}
            </Text>
          ) : transactions.length === 0 ? (
            <EmptyActivity />
          ) : (
            <View>
              {transactions.slice(0, 6).map((tx, idx) => (
                <View key={tx.id}>
                  <AttendeeTxRow tx={tx} />
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
        title="Wallet"
        left={<ProfileButton />}
        right={<ScopeChip />}
      />
    </Screen>
  );
}

function BraceletCard({ bracelet }: { bracelet: MyBraceletRow }) {
  return (
    <ImageBackground
      source={CURRENCIES_IMAGE}
      resizeMode="cover"
      imageStyle={{ borderRadius: 24 }}
      className="overflow-hidden rounded-3xl border border-white"
    >
      <View className="px-6 py-7 items-center">
        <Text
          className="text-muted text-sm font-medium"
          numberOfLines={1}
        >
          {bracelet.eventName ?? 'Festival balance'}
        </Text>
        <Text className="mt-2 text-black text-4xl font-bold tracking-tight">
          {formatBalance(bracelet.balance)}
        </Text>

        <View style={{ height: 48, width: 160 }} className="mt-3">
          <TopupButton
            onPress={() =>
              router.push({
                pathname: '/topup',
                params: { braceletId: bracelet.id },
              })
            }
          />
        </View>
      </View>
    </ImageBackground>
  );
}

type IconStyle = {
  bg: string;
  fg: string;
  icon: 'add' | 'beer-outline' | 'bag-handle-outline';
};

function iconStyleFor(tx: Transaction): IconStyle {
  if (tx.type === 'credit') {
    return { bg: '#dcfce7', fg: '#15803d', icon: 'add' };
  }
  return { bg: '#16a34a', fg: '#ffffff', icon: 'beer-outline' }
}

function AttendeeTxRow({ tx }: { tx: Transaction }) {
  const style = iconStyleFor(tx);
  const isCredit = tx.type === 'credit';
  const amountText = `${isCredit ? '+' : '-'}${formatBalance(Math.abs(tx.amount))}`;
  return (
    <ActivityRow
      icon={style.icon}
      iconBg={style.bg}
      iconFg={style.fg}
      title={activityTitle(tx)}
      subtitle={activitySubtitle(tx)}
      amount={amountText}
      time={formatTimestamp(tx.serverTimestamp)}
    />
  );
}

function activityTitle(tx: Transaction): string {
  if (tx.type === 'credit') return 'Top-up';
  const meta = tx.metadata as { vendorName?: string } | null;
  return meta?.vendorName ?? 'Payment';
}

function activitySubtitle(tx: Transaction): string {
  if (tx.type === 'credit') return tx.eventName ?? 'Top-up';
  const meta = tx.metadata as { category?: string } | null;
  return meta?.category ?? tx.eventName ?? 'Payment';
}

function formatBalance(minor: number): string {
  return formatMoney(minor);
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

function EmptyActivity() {
  return (
    <View className="items-center rounded-2xl bg-surface px-6 py-10">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name="receipt-outline" size={22} color="#0a0a0a" />
      </View>
      <Text className="text-base font-semibold text-foreground">
        No transactions yet
      </Text>
      <Text className="mt-1 text-center text-xs text-muted">
        Your payments will appear here once you start spending.
      </Text>
    </View>
  );
}
