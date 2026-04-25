import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spinner } from 'heroui-native';
import QRCode from 'react-native-qrcode-svg';
import { useMutation } from '@tanstack/react-query';

import { Screen } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api';
import { braceletsApi } from '@/lib/api/bracelets';
import { useMyEvents } from '@/hooks';

type Stage = 'intro' | 'qr';

type QrPayload = {
  v: 1;
  eventId: string;
  token: string;
  expiresAt: number;
};

export default function EventQrScreen() {
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = params.eventId ?? '';
  const eventsQuery = useMyEvents();
  const event = eventsQuery.data?.find((e) => e.id === eventId);
  const isLinked = !!event?.linkedWristbandUid;

  const [stage, setStage] = useState<Stage>('intro');

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable
          onPress={() => (stage === 'qr' ? setStage('intro') : router.back())}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={26} color="#0a0a0a" />
        </Pressable>
        <Text className="ml-2 text-lg font-semibold text-foreground">
          {event?.name ?? 'Festival pass'}
        </Text>
      </View>

      {stage === 'intro' ? (
        <IntroStage
          isLinked={isLinked}
          wristbandUid={event?.linkedWristbandUid ?? null}
          onContinue={() => setStage('qr')}
        />
      ) : (
        <QrStage eventId={eventId} />
      )}
    </Screen>
  );
}

function IntroStage({
  isLinked,
  wristbandUid,
  onContinue,
}: {
  isLinked: boolean;
  wristbandUid: string | null;
  onContinue: () => void;
}) {
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <Text className="text-2xl font-bold text-foreground">
          Get your bracelet
        </Text>
        <Text className="mt-2 text-sm text-muted">
          Pick up your bracelet at the festival, then come back here.
        </Text>

        {isLinked ? (
          <View
            className="mt-5 rounded-2xl px-5 py-4 flex-row items-start gap-3"
            style={{ backgroundColor: '#dcfce7' }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#15803d" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-success">
                You're all set
              </Text>
              <Text className="mt-1 text-xs text-muted">
                Your bracelet is connected. You only need a new code if you
                lose your bracelet and get a new one.
              </Text>
            </View>
          </View>
        ) : null}

        <View className="mt-6 gap-3">
          <Step
            index={1}
            icon="walk-outline"
            title="Go to the entrance"
            body="Head to the festival gate or the info point."
          />
          <Step
            index={2}
            icon="qr-code-outline"
            title="Show them your code"
            body="Tap the button below and hold your screen up to the staff."
          />
        </View>

        <Pressable
          onPress={onContinue}
          className="mt-8 rounded-2xl bg-foreground px-6 py-4 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="qr-code-outline" size={18} color="#ffffff" />
          <Text className="text-base font-semibold text-background">
            {isLinked ? 'Show my code anyway' : 'Show my code'}
          </Text>
        </Pressable>

        <Text className="mt-3 text-center text-xs text-muted">
          Tap that only when you're standing in front of the staff. The code
          works for 5 minutes.
        </Text>
      </ScrollView>
    </View>
  );
}

function Step({
  index,
  icon,
  title,
  body,
}: {
  index: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View className="rounded-2xl bg-surface px-5 py-4 flex-row gap-4">
      <View className="items-center" style={{ width: 36 }}>
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: '#0a0a0a' }}
        >
          <Text className="text-sm font-bold text-background">{index}</Text>
        </View>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon} size={16} color="#0a0a0a" />
          <Text className="text-base font-semibold text-foreground">
            {title}
          </Text>
        </View>
        <Text className="mt-1 text-sm text-muted">{body}</Text>
      </View>
    </View>
  );
}

function QrStage({ eventId }: { eventId: string }) {
  const [token, setToken] = useState<{
    token: string;
    expiresAt: number;
  } | null>(null);

  const tokenMutation = useMutation({
    mutationFn: () => braceletsApi.issueLinkToken(eventId),
    onSuccess: (data) => setToken(data),
  });

  useEffect(() => {
    if (eventId) tokenMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const qrPayload = useMemo<string | null>(() => {
    if (!token) return null;
    const payload: QrPayload = {
      v: 1,
      eventId,
      token: token.token,
      expiresAt: token.expiresAt,
    };
    return JSON.stringify(payload);
  }, [token, eventId]);

  const error = tokenMutation.error
    ? extractErrorMessage(tokenMutation.error)
    : null;

  return (
    <View className="flex-1 items-center justify-center px-6 bg-background">
      <View className="rounded-3xl bg-surface px-6 py-8 items-center w-full">
        <Text className="text-base font-semibold text-foreground">
          Hold this up to their phone
        </Text>
        <Text className="mt-1 text-center text-xs text-muted">
          They point their camera at the code, then touch your bracelet to
          their phone.
        </Text>

        <View className="mt-6 mb-4 rounded-2xl bg-background p-4">
          {tokenMutation.isPending && !qrPayload ? (
            <View className="h-64 w-64 items-center justify-center">
              <Spinner color="#0a0a0a" />
            </View>
          ) : qrPayload ? (
            <QRCode value={qrPayload} size={240} />
          ) : (
            <View className="h-64 w-64 items-center justify-center">
              <Ionicons name="alert-circle-outline" size={28} color="#dc2626" />
            </View>
          )}
        </View>

        {token ? <Countdown expiresAt={token.expiresAt} /> : null}

        <Pressable
          onPress={() => tokenMutation.mutate()}
          className="mt-5 flex-row items-center gap-2"
        >
          <Ionicons name="refresh" size={16} color="#0a0a0a" />
          <Text className="text-sm font-medium text-foreground">
            Refresh code
          </Text>
        </Pressable>

        {error ? (
          <Text className="mt-3 text-center text-xs text-danger">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, expiresAt - now);
  const seconds = Math.floor(remaining / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  if (remaining <= 0) {
    return (
      <Text className="text-xs text-danger">
        Code expired, refresh below.
      </Text>
    );
  }
  return (
    <Text className="text-xs text-muted">
      Refreshes in {mm}:{ss.toString().padStart(2, '0')}
    </Text>
  );
}
