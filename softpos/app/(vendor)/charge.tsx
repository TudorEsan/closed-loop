import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Alert,
  Button,
  Chip,
  Description,
  Dialog,
  Input,
  Label,
  Spinner,
  TextField,
} from 'heroui-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { sessionStore } from '@/lib/storage';
import { devicesApi } from '@/lib/api/devices';
import { transactionsApi, type ChargeBody } from '@/lib/api/transactions';
import { extractErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';

const TEST_WRISTBAND = 'TEST-WRISTBAND-001';

function makeIdempotencyKey(): string {
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChargeScreen() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // amount is kept as a string of digits (minor units, i.e. cents). Using
  // digits directly avoids floating point headaches.
  const [amountStr, setAmountStr] = useState('0');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [manualUid, setManualUid] = useState('');
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const e = await sessionStore.getSelectedEvent();
      const v = await sessionStore.getSelectedVendor();
      setEventId(e);
      setVendorId(v);
      setReady(true);
    })();
  }, []);

  const devicesQuery = useQuery({
    enabled: !!eventId && !!vendorId,
    queryKey: ['devices', eventId, vendorId],
    queryFn: () =>
      devicesApi.listForVendor(eventId as string, vendorId as string),
  });

  const activeDevice = useMemo(
    () => devicesQuery.data?.devices.find((d) => d.status === 'active') ?? null,
    [devicesQuery.data],
  );

  const amountCents = parseInt(amountStr || '0', 10);

  const chargeMutation = useMutation({
    mutationFn: async (wristbandUid: string) => {
      if (!eventId || !vendorId) throw new Error('Vendor context missing');
      if (!activeDevice) throw new Error('No approved device');
      if (amountCents <= 0) throw new Error('Amount must be greater than zero');

      const body: ChargeBody = {
        wristbandUid,
        amount: amountCents,
        deviceId: activeDevice.id,
        idempotencyKey: makeIdempotencyKey(),
        clientTimestamp: new Date().toISOString(),
      };
      return transactionsApi.charge(eventId, vendorId, body);
    },
    onSuccess: () => {
      setSuccessAmount(amountCents);
      setChargeError(null);
      setSheetOpen(false);
      setManualUid('');
      setAmountStr('0');
    },
    onError: (err) => {
      setChargeError(extractErrorMessage(err));
    },
  });

  function pressDigit(d: string) {
    setAmountStr((prev) => {
      if (prev === '0') return d;
      if (prev.length >= 7) return prev; // cap it so it doesn't go crazy
      return prev + d;
    });
  }

  function pressBackspace() {
    setAmountStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  }

  function pressDoubleZero() {
    setAmountStr((prev) => {
      if (prev === '0') return '0';
      if (prev.length >= 6) return prev;
      return prev + '00';
    });
  }

  if (!ready || devicesQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  if (!eventId || !vendorId) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <Label className="text-xl font-semibold">Setup missing</Label>
          <Description>Pick an event and a vendor first.</Description>
          <Button onPress={() => router.replace('/(vendor)/setup')}>
            Go to setup
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeDevice) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6 gap-3">
          <Label className="text-xl font-semibold text-foreground">
            Device not approved yet
          </Label>
          <Description className="text-center">
            An organizer needs to approve your device before you can take
            payments.
          </Description>
          <Button onPress={() => router.replace('/(vendor)/register-device')}>
            Register device
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Success state
  if (successAmount !== null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6 gap-5">
          <View className="h-24 w-24 rounded-full bg-success items-center justify-center">
            <Label className="text-5xl text-white font-bold">OK</Label>
          </View>
          <Label className="text-3xl font-bold text-foreground">Charged</Label>
          <Label className="text-4xl font-bold text-foreground">
            {formatMoney(successAmount)}
          </Label>
          <Button
            onPress={() => {
              setSuccessAmount(null);
            }}
            className="w-full h-14"
          >
            New payment
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.replace('/(vendor)')}
          >
            Back to home
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-5 py-4 gap-4">
        <View className="flex-row justify-between items-center">
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>
          <Chip size="sm" variant="soft" color="warning">
            <Chip.Label>TEST MODE</Chip.Label>
          </Chip>
        </View>

        {/* Amount display */}
        <View className="items-center py-6">
          <Description>Amount</Description>
          <Label className="text-6xl font-bold text-foreground mt-2">
            {formatMoney(amountCents)}
          </Label>
        </View>

        {/* Keypad */}
        <View className="flex-1 gap-3">
          <View className="flex-row gap-3">
            <KeypadButton label="1" onPress={() => pressDigit('1')} />
            <KeypadButton label="2" onPress={() => pressDigit('2')} />
            <KeypadButton label="3" onPress={() => pressDigit('3')} />
          </View>
          <View className="flex-row gap-3">
            <KeypadButton label="4" onPress={() => pressDigit('4')} />
            <KeypadButton label="5" onPress={() => pressDigit('5')} />
            <KeypadButton label="6" onPress={() => pressDigit('6')} />
          </View>
          <View className="flex-row gap-3">
            <KeypadButton label="7" onPress={() => pressDigit('7')} />
            <KeypadButton label="8" onPress={() => pressDigit('8')} />
            <KeypadButton label="9" onPress={() => pressDigit('9')} />
          </View>
          <View className="flex-row gap-3">
            <KeypadButton label="00" onPress={pressDoubleZero} />
            <KeypadButton label="0" onPress={() => pressDigit('0')} />
            <KeypadButton label="<" onPress={pressBackspace} />
          </View>
        </View>

        <Button
          onPress={() => {
            setChargeError(null);
            setSheetOpen(true);
          }}
          isDisabled={amountCents <= 0}
          className="h-16"
        >
          <Button.Label className="text-lg font-semibold">
            Charge {formatMoney(amountCents)}
          </Button.Label>
        </Button>
      </View>

      <Dialog
        isOpen={sheetOpen}
        onOpenChange={(open) => {
          if (!chargeMutation.isPending) {
            setSheetOpen(open);
            if (!open) setChargeError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            <Dialog.Title>Tap the wristband</Dialog.Title>
            <Dialog.Description>
              Hold the wristband on the back of the device. In test mode you
              can also type a UID or tap the button below.
            </Dialog.Description>

            <View className="gap-3 mt-3">
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Test mode</Alert.Title>
                  <Alert.Description>
                    DESFire is not wired yet. Use the test wristband for now.
                  </Alert.Description>
                </Alert.Content>
              </Alert>

              <TextField>
                <Label>Wristband UID</Label>
                <Input
                  value={manualUid}
                  onChangeText={setManualUid}
                  placeholder="Type or paste UID"
                  autoCapitalize="none"
                />
              </TextField>

              {chargeError ? (
                <Description className="text-danger">{chargeError}</Description>
              ) : null}

              <Button
                onPress={() => {
                  const uid = manualUid.trim();
                  if (!uid) return;
                  chargeMutation.mutate(uid);
                }}
                isDisabled={chargeMutation.isPending || !manualUid.trim()}
              >
                {chargeMutation.isPending ? <Spinner /> : 'Confirm manual UID'}
              </Button>

              <Button
                variant="secondary"
                onPress={() => chargeMutation.mutate(TEST_WRISTBAND)}
                isDisabled={chargeMutation.isPending}
              >
                Simulate tap (test UID)
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </SafeAreaView>
  );
}

function KeypadButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center bg-muted/30 rounded-2xl active:bg-muted/50"
      style={{ minHeight: 68 }}
    >
      <Label className="text-3xl font-semibold text-foreground">{label}</Label>
    </Pressable>
  );
}
