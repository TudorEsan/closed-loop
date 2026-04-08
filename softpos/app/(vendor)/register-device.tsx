import { useEffect, useMemo, useState } from 'react';
import { Alert as RNAlert, Dimensions, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Spinner,
  TextField,
} from 'heroui-native';
import { useMutation } from '@tanstack/react-query';

import { sessionStore } from '@/lib/storage';
import { devicesApi, type RegisterDeviceBody } from '@/lib/api/devices';
import { extractErrorMessage } from '@/lib/api';
import type { Device } from '@/types/api';

// Simple deterministic string hash, nothing cryptographic. It is only used as
// a stable "fingerprint" string for the backend.
function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  // make it look like a hex string
  return Math.abs(h).toString(16).padStart(8, '0');
}

const DEVICE_UUID_KEY = 'softpos.deviceUUID';

async function getStableUUID(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_UUID_KEY);
  if (existing) return existing;
  // No uuid lib, make one from random bits
  const uuid = `${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
  await SecureStore.setItemAsync(DEVICE_UUID_KEY, uuid);
  return uuid;
}

type DeviceInfo = {
  deviceModel: string;
  osName: string;
  osVersion: string;
  appVersion: string;
  screenWidth: number;
  screenHeight: number;
  stableUUID: string;
  deviceFingerprint: string;
};

export default function RegisterDeviceScreen() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [registered, setRegistered] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const e = await sessionStore.getSelectedEvent();
      const v = await sessionStore.getSelectedVendor();
      setEventId(e);
      setVendorId(v);

      const { width, height } = Dimensions.get('window');
      const platformIosModel =
        ((Constants.platform as unknown) as {
          ios?: { model?: string | null };
        } | undefined)?.ios?.model ?? null;
      const deviceModel =
        Constants.deviceName ?? platformIosModel ?? 'Unknown device';
      const osName = Platform.OS;
      const osVersion = String(Platform.Version);
      const appVersion = Constants.expoConfig?.version ?? '0.0.0';
      const stableUUID = await getStableUUID();
      const fingerprintInput = `${deviceModel}|${osName}|${osVersion}|${stableUUID}`;

      setInfo({
        deviceModel,
        osName,
        osVersion,
        appVersion,
        screenWidth: Math.round(width),
        screenHeight: Math.round(height),
        stableUUID,
        deviceFingerprint: simpleHash(fingerprintInput),
      });

      // Location is optional. If expo-location is ever added to the project,
      // wire it up here. For now we skip it and leave lat/lng undefined.
    })();
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!eventId || !vendorId) throw new Error('Vendor context missing');
      if (!token.trim()) throw new Error('Please paste a registration token');
      if (!info) throw new Error('Device info not ready yet');

      const body: RegisterDeviceBody = {
        registrationToken: token.trim(),
        deviceModel: info.deviceModel,
        osName: info.osName,
        osVersion: info.osVersion,
        appVersion: info.appVersion,
        screenWidth: info.screenWidth,
        screenHeight: info.screenHeight,
        deviceFingerprint: info.deviceFingerprint,
      };
      return devicesApi.register(eventId, vendorId, body);
    },
    onSuccess: (dev) => {
      setRegistered(dev);
      setError(null);
      RNAlert.alert(
        'Device sent for approval',
        'An organizer will review it soon.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(vendor)'),
          },
        ],
      );
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
    },
  });

  const canSubmit = useMemo(
    () => !!info && !!token.trim() && !mutation.isPending,
    [info, token, mutation.isPending],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-6 py-6 gap-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Label className="text-2xl font-bold text-foreground">
            Register device
          </Label>
          <Description>
            Paste the registration token you got from the organizer. We then
            send your device info so they can approve it.
          </Description>
        </View>

        <Card>
          <Card.Body className="gap-3">
            <TextField>
              <Label>Registration token</Label>
              <Input
                value={token}
                onChangeText={setToken}
                placeholder="Paste token here"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body className="gap-2">
            <Label className="text-base font-semibold text-foreground">
              Device info
            </Label>
            {info ? (
              <View className="gap-1">
                <InfoRow label="Model" value={info.deviceModel} />
                <InfoRow label="OS" value={`${info.osName} ${info.osVersion}`} />
                <InfoRow label="App version" value={info.appVersion} />
                <InfoRow
                  label="Screen"
                  value={`${info.screenWidth} x ${info.screenHeight}`}
                />
                <InfoRow label="Fingerprint" value={info.deviceFingerprint} />
                <InfoRow label="Location" value="not shared" />
              </View>
            ) : (
              <Spinner />
            )}
          </Card.Body>
        </Card>

        {error ? (
          <Description className="text-danger">{error}</Description>
        ) : null}

        {registered ? (
          <Card>
            <Card.Body className="gap-2">
              <Label className="text-base font-semibold text-foreground">
                Submitted
              </Label>
              <InfoRow label="Device id" value={registered.id} />
              <View className="flex-row mt-1">
                <Chip size="sm" variant="soft" color="warning">
                  <Chip.Label>{registered.status}</Chip.Label>
                </Chip>
              </View>
            </Card.Body>
          </Card>
        ) : null}

        <Button
          onPress={() => mutation.mutate()}
          isDisabled={!canSubmit}
        >
          {mutation.isPending ? <Spinner /> : 'Submit for approval'}
        </Button>

        <Button
          variant="ghost"
          onPress={() => router.back()}
          isDisabled={mutation.isPending}
        >
          Back
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Description>{label}</Description>
      <Description className="text-foreground">{value}</Description>
    </View>
  );
}
