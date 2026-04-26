import { RefreshControl, ScrollView, Text, View } from 'react-native';
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
          <View>
            <Text className="text-sm font-semibold text-foreground">
              You're in
            </Text>
            <Text className="mt-0.5 text-xs text-muted">
              Your bracelet is connected. Ready to pay.
            </Text>
            <View className="mt-3 gap-3">
              {items.map((event) => (
                <FestivalCard key={event.id} event={event} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function FestivalCard({ event }: { event: MyEventRow }) {
  return (
    <View className="rounded-2xl bg-surface px-5 py-4">
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
      {event.linkedWristbandUid ? (
        <Text className="mt-3 text-xs text-muted font-mono">
          Bracelet {event.linkedWristbandUid}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 pt-20">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-secondary mb-4">
        <Ionicons name="calendar-outline" size={26} color="#0a0a0a" />
      </View>
      <Text className="text-base font-semibold text-foreground">
        No festivals yet
      </Text>
      <Text className="mt-2 text-center text-sm text-muted">
        Your festivals show up here once your bracelet has been linked at the
        gate. The organizer sends you a ticket by email.
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
