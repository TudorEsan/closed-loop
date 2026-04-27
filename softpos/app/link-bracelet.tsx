import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Spinner } from 'heroui-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { NfcPulse, Screen } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api';
import { useNfc } from '@/hooks/use-nfc';
import { braceletsApi, type RedeemTicketResponse } from '@/lib/api/bracelets';

type Step = 'scan-qr' | 'read-nfc' | 'submitting' | 'done';

export default function LinkBraceletScreen() {
  const [step, setStep] = useState<Step>('scan-qr');
  const [permission, requestPermission] = useCameraPermissions();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemTicketResponse | null>(null);
  const lastScanRef = useRef<number>(0);
  const queryClient = useQueryClient();
  const nfc = useNfc();

  const redeemMutation = useMutation({
    mutationFn: (input: { token: string; uid: string }) =>
      braceletsApi.redeemTicket({
        token: input.token,
        wristbandUid: input.uid,
      }),
    onSuccess: (data) => {
      setResult(data);
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

    const candidate = value.trim();
    if (candidate.length < 10) {
      setError('That does not look like a ticket QR.');
      return;
    }
    setToken(candidate);
    setError(null);
    setStep('read-nfc');
  }

  async function readNfc() {
    if (!token || nfc.isBusy) return;
    if (!nfc.isAvailable) {
      Alert.alert(
        'NFC not available',
        'This device does not support NFC reading.',
      );
      return;
    }
    nfc.clearError();
    setError(null);
    const res = await nfc.initializeBracelet();
    if (res.kind === 'ok') {
      submit(res.uid);
    } else if (res.kind === 'already-initialized') {
      setError(
        'This bracelet is already initialized. Use a fresh wristband or have it reset.',
      );
    } else if (res.kind === 'error') {
      setError(res.error);
    }
  }

  async function cancelScan() {
    await nfc.cancel();
  }

  function submit(uid: string) {
    if (!token) return;
    setStep('submitting');
    setError(null);
    redeemMutation.mutate({ token, uid });
  }

  function startOver() {
    setToken(null);
    setResult(null);
    setError(null);
    setStep('scan-qr');
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
          onTap={readNfc}
          onCancel={cancelScan}
          isScanning={nfc.isBusy}
          isSubmitting={step === 'submitting'}
          error={error}
        />
      ) : null}

      {step === 'done' && result ? (
        <DoneStep result={result} onAgain={startOver} />
      ) : null}
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
          We use the camera to scan the attendee ticket QR.
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
          Step 1 of 2 — Scan the ticket QR from the email
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
  onTap,
  onCancel,
  isScanning,
  isSubmitting,
  error,
}: {
  onTap: () => void;
  onCancel: () => void;
  isScanning: boolean;
  isSubmitting: boolean;
  error: string | null;
}) {
  const busy = isScanning || isSubmitting;

  return (
    <View className="flex-1 px-5 bg-background">
      <View className="self-start rounded-full bg-surface px-3 py-1.5">
        <Text className="text-xs font-medium text-muted">Step 2 of 2</Text>
      </View>

      <View className="mt-5 overflow-hidden rounded-3xl bg-foreground px-6 py-10 items-center">
        <View className="h-72 w-72 items-center justify-center">
          <NfcPulse active={isScanning} />
          <View className="h-32 w-32 items-center justify-center rounded-full bg-white/10 border border-white/20">
            <Ionicons
              name="wifi"
              size={56}
              color="#ffffff"
              style={{ transform: [{ rotate: '-90deg' }] }}
            />
          </View>
        </View>

        <Text className="mt-2 text-xl font-semibold text-white text-center">
          {isScanning
            ? 'Scanning...'
            : isSubmitting
              ? 'Linking bracelet'
              : 'Hold the bracelet near the phone'}
        </Text>
        <Text className="mt-2 text-sm text-white/70 text-center">
          {isScanning
            ? 'Keep the wristband still on the back of the device'
            : 'Ticket scanned, now tap the wristband'}
        </Text>
      </View>

      <View className="mt-6">
        {isSubmitting ? (
          <View className="items-center py-3">
            <Spinner color="#0a0a0a" />
          </View>
        ) : isScanning ? (
          <Pressable
            onPress={onCancel}
            className="rounded-full bg-surface px-5 py-4 items-center"
          >
            <Text className="text-base font-semibold text-foreground">
              Cancel
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onTap}
            disabled={busy}
            className="rounded-full bg-foreground px-5 py-4 items-center"
            style={{ opacity: busy ? 0.5 : 1 }}
          >
            <Text className="text-base font-semibold text-white">
              {Platform.OS === 'ios' ? 'Start NFC scan' : 'Read tag'}
            </Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <Text className="mt-4 text-center text-sm text-danger">{error}</Text>
      ) : null}
    </View>
  );
}

function DoneStep({
  result,
  onAgain,
}: {
  result: RedeemTicketResponse;
  onAgain: () => void;
}) {
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
        {result.email} can now pay at vendors of {result.eventName}.
      </Text>
      <View className="mt-6 w-full gap-3">
        <Pressable
          onPress={onAgain}
          className="rounded-2xl bg-foreground px-5 py-3 items-center"
        >
          <Text className="text-sm font-semibold text-background">
            Link another
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/home')}
          className="rounded-2xl bg-surface px-5 py-3 items-center"
        >
          <Text className="text-sm font-semibold text-foreground">Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

