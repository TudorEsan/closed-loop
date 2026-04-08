import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Description,
  Label,
  Spinner,
} from 'heroui-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { eventsApi } from '@/lib/api/events';
import { sessionStore } from '@/lib/storage';
import { extractErrorMessage } from '@/lib/api';
import type { EventSummary } from '@/types/api';

export default function SelectEventScreen() {
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ['events', 'list'],
    queryFn: () => eventsApi.list(),
  });

  async function handlePick(eventId: string) {
    await sessionStore.setSelectedEvent(eventId);
    // Reset wallet + event caches so next screen fetches fresh data
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
    queryClient.invalidateQueries({ queryKey: ['event'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-tx-preview'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(attendee)');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-1">
          <Label className="text-2xl font-bold text-foreground">
            Pick an event
          </Label>
          <Description>Choose the festival you are going to.</Description>
        </View>
        {router.canGoBack() ? (
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            Close
          </Button>
        ) : null}
      </View>

      {eventsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : eventsQuery.isError ? (
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <Description className="text-danger">
            {extractErrorMessage(eventsQuery.error)}
          </Description>
          <Button variant="secondary" onPress={() => eventsQuery.refetch()}>
            Try again
          </Button>
        </View>
      ) : (
        <FlatList
          data={eventsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 12,
            paddingBottom: 40,
          }}
          refreshing={eventsQuery.isRefetching}
          onRefresh={() => eventsQuery.refetch()}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-6 gap-2">
              <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
              <Label className="text-base font-medium text-foreground">
                No events available
              </Label>
              <Description>Check back a bit later.</Description>
            </View>
          }
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => handlePick(item.id)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function EventCard({
  event,
  onPress,
}: {
  event: EventSummary;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card className="p-4">
        <Card.Body className="gap-2">
          <View className="flex-row items-center justify-between">
            <Label className="text-base font-semibold text-foreground flex-1 pr-2">
              {event.name}
            </Label>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Description>
              {formatRange(event.startDate, event.endDate)}
            </Description>
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons name="pulse-outline" size={14} color="#6b7280" />
            <Description className="capitalize">{event.status}</Description>
          </View>
        </Card.Body>
      </Card>
    </Pressable>
  );
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
    };
    return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
  } catch {
    return `${start} - ${end}`;
  }
}
