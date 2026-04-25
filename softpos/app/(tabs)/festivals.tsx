import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spinner } from 'heroui-native';

import { extractErrorMessage } from '@/lib/api';
import { Screen } from '@/components/ui';
import { useMyEvents } from '@/hooks';
import type { MyEventRow } from '@/lib/api/bracelets';

export default function FestivalsScreen() {
  const eventsQuery = useMyEvents();
  const error = eventsQuery.error
    ? extractErrorMessage(eventsQuery.error)
    : null;
  const items = eventsQuery.data ?? [];

  const { active, available } = useMemo(() => {
    const a: MyEventRow[] = [];
    const b: MyEventRow[] = [];
    for (const e of items) {
      if (e.linkedWristbandUid) a.push(e);
      else b.push(e);
    }
    return { active: a, available: b };
  }, [items]);

  return (
    <Screen edgeBottom={false}>
      <View className="flex-row items-center justify-center px-5 pt-2 pb-4">
        <Text className="text-lg font-semibold text-foreground">
          Festivals
        </Text>
      </View>

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isFetching}
            onRefresh={() => eventsQuery.refetch()}
          />
        }
      >
        {eventsQuery.isLoading ? (
          <View className="items-center py-12">
            <Spinner color="#0a0a0a" />
          </View>
        ) : error ? (
          <Text className="text-sm text-danger">
            Could not load festivals. {error}
          </Text>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <View className="gap-6">
            {active.length > 0 ? (
              <Section
                title="You're in"
                subtitle="Your bracelet is connected. Ready to pay."
              >
                {active.map((event) => (
                  <ActiveCard key={event.id} event={event} />
                ))}
              </Section>
            ) : null}

            {available.length > 0 ? (
              <Section
                title="Link your bracelet"
                subtitle="Tap a festival to see how it works."
              >
                {available.map((event) => (
                  <AvailableCard key={event.id} event={event} />
                ))}
              </Section>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      <Text className="mt-0.5 text-xs text-muted">{subtitle}</Text>
      <View className="mt-3 gap-3">{children}</View>
    </View>
  );
}

function ActiveCard({ event }: { event: MyEventRow }) {
  return (
    <Pressable
      onPress={() => router.push(`/event-qr?eventId=${event.id}`)}
      className="rounded-2xl bg-surface px-5 py-4"
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: '#dcfce7' }}
        >
          <Ionicons name="checkmark" size={20} color="#15803d" />
        </View>
        <View className="flex-1">
          <Text
            className="text-base font-semibold text-foreground"
            numberOfLines={1}
          >
            {event.name}
          </Text>
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {formatDateRange(event.startDate, event.endDate)}
          </Text>
        </View>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: '#dcfce7' }}
        >
          <Text className="text-xs font-semibold text-success">Connected</Text>
        </View>
      </View>
    </Pressable>
  );
}

function AvailableCard({ event }: { event: MyEventRow }) {
  return (
    <Pressable
      onPress={() => router.push(`/event-qr?eventId=${event.id}`)}
      className="rounded-2xl border border-border bg-surface px-5 py-4"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <Ionicons name="calendar-outline" size={20} color="#0a0a0a" />
        </View>
        <View className="flex-1">
          <Text
            className="text-base font-semibold text-foreground"
            numberOfLines={1}
          >
            {event.name}
          </Text>
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {formatDateRange(event.startDate, event.endDate)}
          </Text>
        </View>
        <View className="rounded-full bg-foreground px-3 py-1.5">
          <Text className="text-xs font-semibold text-background">
            Get bracelet
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 pt-20">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-secondary mb-4">
        <Ionicons name="calendar-outline" size={26} color="#0a0a0a" />
      </View>
      <Text className="text-base font-semibold text-foreground">
        Nothing here yet
      </Text>
      <Text className="mt-2 text-center text-sm text-muted">
        Festivals show up here when they're open. Come back when you arrive at
        the gate.
      </Text>
    </View>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString('en-GB', { day: 'numeric' })} to ${end.toLocaleDateString('en-GB', opts)}`;
  }
  return `${start.toLocaleDateString('en-GB', opts)} to ${end.toLocaleDateString('en-GB', opts)}`;
}
