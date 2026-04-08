import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  Card,
  Description,
  Label,
  Separator,
  Spinner,
} from 'heroui-native';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { eventsApi } from '@/lib/api/events';
import { sessionStore } from '@/lib/storage';
import { extractErrorMessage } from '@/lib/api';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [eventId, setEventId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const id = await sessionStore.getSelectedEvent();
        if (active) {
          setEventId(id);
          setReady(true);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.get(eventId as string),
    enabled: !!eventId,
  });

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // even if sign out errors on the server we still want to bail out
    } finally {
      setSigningOut(false);
      router.replace('/login');
    }
  }

  const initials = (user?.name ?? user?.email ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 20,
          paddingBottom: 40,
        }}
      >
        <View className="gap-1">
          <Label className="text-2xl font-bold text-foreground">Profile</Label>
          <Description>Your account info and settings.</Description>
        </View>

        <Card className="p-5">
          <Card.Body className="gap-4">
            <View className="flex-row items-center gap-4">
              <Avatar alt={user?.name ?? user?.email ?? 'user'}>
                <Avatar.Fallback>{initials}</Avatar.Fallback>
              </Avatar>
              <View className="flex-1">
                <Label className="text-base font-semibold text-foreground">
                  {user?.name ?? 'Unnamed attendee'}
                </Label>
                <Description>{user?.email ?? 'no email'}</Description>
                {user?.role ? (
                  <Description className="capitalize">
                    Role: {user.role}
                  </Description>
                ) : null}
              </View>
            </View>
          </Card.Body>
        </Card>

        <Card className="p-5">
          <Card.Body className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="calendar-outline" size={18} color="#6b7280" />
              <Label className="text-base font-semibold text-foreground">
                Current event
              </Label>
            </View>
            {!ready ? (
              <Spinner />
            ) : !eventId ? (
              <Description>No event picked yet.</Description>
            ) : eventQuery.isLoading ? (
              <Spinner />
            ) : eventQuery.isError ? (
              <Description className="text-danger">
                {extractErrorMessage(eventQuery.error)}
              </Description>
            ) : (
              <Description>
                {eventQuery.data?.name ?? 'Unknown event'}
              </Description>
            )}
            <Separator />
            <Button
              variant="secondary"
              onPress={() => router.push('/(attendee)/select-event')}
            >
              {eventId ? 'Change event' : 'Pick an event'}
            </Button>
          </Card.Body>
        </Card>

        <Button
          variant="danger"
          onPress={handleSignOut}
          isDisabled={signingOut}
        >
          {signingOut ? <Spinner /> : 'Sign out'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
