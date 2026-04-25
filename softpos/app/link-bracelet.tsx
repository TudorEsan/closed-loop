import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Spinner } from 'heroui-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api';
import { braceletsApi } from '@/lib/api/bracelets';

type Step = 'scan-qr' | 'read-nfc' | 'submitting' | 'done';

type ParsedQr = {
  eventId: string;
  token: string;
  expiresAt: number;
};

// Lazy require so the bundler does not pull native NFC bindings on web or
// when the dev build does not include them.
let NfcManager: typeof import('react-native-nfc-manager').default | null = null;
let NfcTech: typeof import('react-native-nfc-manager').NfcTech | null = null;
try {
  const mod = require('react-native-nfc-manager');
  NfcManager = mod.default;
  NfcTech = mod.NfcTech;
} catch {
  NfcManager = null;
}

export default function LinkBraceletScreen() {
  const [step, setStep] = useState<Step>('scan-qr');
  const [permission, requestPermission] = useCameraPermissions();
  const [parsed, setParsed] = useState<ParsedQr | null>(null);
  const [manualUid, setManualUid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lastScanRef = useRef<number>(0);
  const queryClient = useQueryClient();

  const linkMutation = useMutation({
    mutationFn: (input: { eventId: string; token: string; uid: string }) =>
      braceletsApi.linkByToken({
        eventId: input.eventId,
        linkToken: input.token,
        wristbandUid: input.uid,
      }),
    onSuccess: () => {
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
      setStep('read-nfc');
    },
  });

  function onQrScanned(value: string) {
    const now = Date.now();
    if (now - lastScanRef.current < 1500) return;
    lastScanRef.current = now;
    try {
      const json = JSON.parse(value);
      if (
        !json ||
        typeof json !== 'object' ||
        typeof json.eventId !== 'string' ||
        typeof json.token !== 'string'
      ) {
        throw new Error('Not a festival QR');
      }
      setParsed({
        eventId: json.eventId,
        token: json.token,
        expiresAt: typeof json.expiresAt === 'number' ? json.expiresAt : 0,
      });
      setError(null);
      setStep('read-nfc');
    } catch (e) {
      setError(`Invalid QR code. ${(e as Error).message}`);
    }
  }

  async function readNfc() {
    if (!parsed) return;
    if (!NfcManager || !NfcTech) {
      Alert.alert(
        'NFC not available',
        'Use the manual UID input below to continue.',
      );
      return;
    }
    try {
      await NfcManager.start();
      await NfcManager.requestTechnology(NfcTech.NfcA);
      const tag = await NfcManager.getTag();
      const uid = tag?.id ?? null;
      if (!uid) {
        throw new Error('Could not read the tag UID');
      }
      submit(uid);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        // ignore
      }
    }
  }

  function submit(uid: string) {
    if (!parsed) return;
    setStep('submitting');
    setError(null);
    linkMutation.mutate({
      eventId: parsed.eventId,
      token: parsed.token,
      uid,
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#0a0a0a" />
        </Pressable>
        <Text className="ml-2 text-lg font-semibold text-foreground">
          Link bracelet
        </Text>
      </View>

      {step === 'scan-qr' ? (
        <ScanQrStep
          permission={permission?.granted ?? false}
          onRequest={requestPermission}
          onScanned={onQrScanned}
          error={error}
        />
      ) : null}

      {step === 'read-nfc' || step === 'submitting' ? (
        <ReadNfcStep
          eventId={parsed?.eventId ?? ''}
          onTap={readNfc}
          manualUid={manualUid}
          setManualUid={setManualUid}
          onManualSubmit={() => submit(manualUid.trim())}
          isSubmitting={step === 'submitting'}
          error={error}
        />
      ) : null}

      {step === 'done' ? <DoneStep /> : null}
    </Screen>
  );
}

function ScanQrStep({
  permission,
  onRequest,
  onScanned,
  error,
}: {
  permission: boolean;
  onRequest: () => void;
  onScanned: (value: string) => void;
  error: string | null;
}) {
  useEffect(() => {
    if (!permission) onRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center px-8 bg-background">
        <Text className="text-base font-semibold text-foreground">
          Camera access needed
        </Text>
        <Text className="mt-2 text-center text-sm text-muted">
          We use the camera to scan the attendee QR code.
        </Text>
        <Pressable
          onPress={onRequest}
          className="mt-6 rounded-2xl bg-foreground px-5 py-3"
        >
          <Text className="text-sm font-semibold text-background">
            Grant access
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-5 pb-3">
        <Text className="text-sm text-muted">
          Step 1 of 2 — Scan the attendee QR
        </Text>
      </View>
      <View className="flex-1 mx-5 overflow-hidden rounded-3xl">
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(e) => onScanned(e.data)}
        />
      </View>
      {error ? (
        <Text className="mx-5 mt-3 text-center text-sm text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ReadNfcStep({
  eventId,
  onTap,
  manualUid,
  setManualUid,
  onManualSubmit,
  isSubmitting,
  error,
}: {
  eventId: string;
  onTap: () => void;
  manualUid: string;
  setManualUid: (v: string) => void;
  onManualSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <View className="flex-1 px-5 bg-background">
      <Text className="text-sm text-muted">Step 2 of 2 — Tap the bracelet</Text>
      <View className="mt-4 rounded-3xl bg-surface px-6 py-8 items-center">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-secondary mb-4">
          <Ionicons name="radio-outline" size={28} color="#0a0a0a" />
        </View>
        <Text className="text-base font-semibold text-foreground">
          Hold the bracelet near the phone
        </Text>
        <Text className="mt-1 text-center text-xs text-muted">
          Event {eventId.slice(0, 8)}…
        </Text>
        <Pressable
          onPress={onTap}
          disabled={isSubmitting}
          className="mt-5 rounded-2xl bg-foreground px-5 py-3"
        >
          {isSubmitting ? (
            <Spinner color="#ffffff" />
          ) : (
            <Text className="text-sm font-semibold text-background">
              {Platform.OS === 'ios' ? 'Start NFC' : 'Read tag'}
            </Text>
          )}
        </Pressable>
      </View>

      <View className="mt-5 rounded-3xl bg-surface px-5 py-5">
        <Text className="text-sm font-semibold text-foreground">
          Or enter the UID manually
        </Text>
        <Text className="mt-1 text-xs text-muted">
          Useful when running on a simulator without NFC.
        </Text>
        <TextInput
          value={manualUid}
          onChangeText={setManualUid}
          placeholder="04:A1:B2:C3:D4:E5:F6"
          autoCapitalize="characters"
          autoCorrect={false}
          className="mt-3 rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground"
        />
        <Pressable
          onPress={onManualSubmit}
          disabled={isSubmitting || manualUid.trim().length < 4}
          className="mt-3 rounded-2xl bg-foreground px-5 py-3 items-center"
          style={{
            opacity: isSubmitting || manualUid.trim().length < 4 ? 0.4 : 1,
          }}
        >
          <Text className="text-sm font-semibold text-background">
            Link bracelet
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text className="mt-4 text-center text-sm text-danger">{error}</Text>
      ) : null}
    </View>
  );
}

function DoneStep() {
  return (
    <View className="flex-1 items-center justify-center px-8 bg-background">
      <View
        className="h-16 w-16 items-center justify-center rounded-full mb-4"
        style={{ backgroundColor: '#dcfce7' }}
      >
        <Ionicons name="checkmark" size={28} color="#15803d" />
      </View>
      <Text className="text-lg font-semibold text-foreground">
        Bracelet linked
      </Text>
      <Text className="mt-2 text-center text-sm text-muted">
        The attendee can now pay at vendors.
      </Text>
      <Pressable
        onPress={() => router.replace('/home')}
        className="mt-6 rounded-2xl bg-foreground px-5 py-3"
      >
        <Text className="text-sm font-semibold text-background">Done</Text>
      </Pressable>
    </View>
  );
}
