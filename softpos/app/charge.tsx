import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Spinner } from 'heroui-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { extractErrorMessage } from '@/lib/api';
import { transactionsApi } from '@/lib/api/transactions';
import { getOrCreateLocalDeviceId } from '@/lib/device-id';
import { Screen, NfcPulse } from '@/components/ui';
import { useScope } from '@/hooks/use-scope';
import { useNfcRead } from '@/hooks/use-nfc-read';
import type { Transaction } from '@/types/api';

type Step = 'amount' | 'tap' | 'submitting' | 'done';

const MIN_AMOUNT = 1;

export default function ChargeScreen() {
  const { scope } = useScope();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Transaction | null>(null);
  const nfc = useNfcRead();

  const vendor = scope?.kind === 'vendor' ? scope.vendor : null;
  const parsed = parseFloat(amount || '0');
  const meetsMin = parsed >= MIN_AMOUNT;

  const chargeMutation = useMutation({
    mutationFn: async (uid: string) => {
      if (!vendor) throw new Error('No vendor scope');
      return transactionsApi.charge(vendor.eventId, vendor.vendorId, {
        wristbandUid: uid,
        amount: Math.round(parsed * 100),
        deviceId: getOrCreateLocalDeviceId(),
        idempotencyKey: idempotencyKey(),
        clientTimestamp: new Date().toISOString(),
        metadata: { vendorName: vendor.businessName },
      });
    },
    onSuccess: (tx) => {
      setResult(tx);
      setStep('done');
      if (vendor) {
        queryClient.invalidateQueries({
          queryKey: ['vendor-tx', vendor.eventId, vendor.vendorId],
        });
      }
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
      setStep('tap');
    },
  });

  if (!vendor) {
    return <NotAVendorScope />;
  }

  function handleKey(key: string) {
    setError(null);
    setAmount((prev) => {
      if (key === '.') {
        if (prev.includes('.')) return prev;
        if (prev.length === 0) return '0.';
        return prev + '.';
      }
      if (prev.includes('.')) {
        const decimals = prev.split('.')[1] ?? '';
        if (decimals.length >= 2) return prev;
      }
      if (prev === '0') return key;
      const next = prev + key;
      if (parseFloat(next) > 9999) return prev;
      return next;
    });
  }

  function handleBackspace() {
    setError(null);
    setAmount((prev) => prev.slice(0, -1));
  }

  function next() {
    if (!meetsMin) return;
    setError(null);
    setStep('tap');
  }

  async function tap() {
    if (!nfc.isAvailable) {
      setError('This device does not support NFC.');
      return;
    }
    setError(null);
    const res = await nfc.read();
    if (!res.uid) {
      if (res.error) setError(res.error);
      return;
    }
    setStep('submitting');
    chargeMutation.mutate(res.uid);
  }

  function startOver() {
    setAmount('');
    setResult(null);
    setError(null);
    setStep('amount');
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable
          onPress={() => (step === 'done' ? router.back() : router.back())}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={26} color="#0a0a0a" />
        </Pressable>
        <View className="ml-2 flex-1">
          <Text className="text-lg font-semibold text-foreground">
            New charge
          </Text>
          <Text className="text-xs text-muted" numberOfLines={1}>
            {vendor.businessName}
          </Text>
        </View>
      </View>

      {step === 'amount' ? (
        <AmountStep
          amount={amount}
          parsed={parsed}
          meetsMin={meetsMin}
          onKey={handleKey}
          onBackspace={handleBackspace}
          onNext={next}
          error={error}
        />
      ) : null}

      {step === 'tap' || step === 'submitting' ? (
        <TapStep
          amount={parsed}
          isScanning={nfc.isScanning}
          isSubmitting={step === 'submitting'}
          onTap={tap}
          onCancel={nfc.cancel}
          error={error}
        />
      ) : null}

      {step === 'done' && result ? (
        <DoneStep amount={parsed} onAgain={startOver} />
      ) : null}
    </Screen>
  );
}

function AmountStep({
  amount,
  parsed,
  meetsMin,
  onKey,
  onBackspace,
  onNext,
  error,
}: {
  amount: string;
  parsed: number;
  meetsMin: boolean;
  onKey: (k: string) => void;
  onBackspace: () => void;
  onNext: () => void;
  error: string | null;
}) {
  const display = amount.length === 0 ? '0' : amount;
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center px-6">
        <View className="flex-row items-end gap-2 relative">
          <AnimatedAmount value={display} />
          <Text className="text-3xl font-bold text-foreground absolute bottom-0 -right-16">
            RON
          </Text>
        </View>
        {error ? (
          <Text className="mt-4 text-center text-sm text-danger">{error}</Text>
        ) : null}
      </View>

      <View className="px-6 pb-4">
        <View className="flex-row">
          <Key label="1" onPress={() => onKey('1')} />
          <Key label="2" onPress={() => onKey('2')} />
          <Key label="3" onPress={() => onKey('3')} />
        </View>
        <View className="flex-row">
          <Key label="4" onPress={() => onKey('4')} />
          <Key label="5" onPress={() => onKey('5')} />
          <Key label="6" onPress={() => onKey('6')} />
        </View>
        <View className="flex-row">
          <Key label="7" onPress={() => onKey('7')} />
          <Key label="8" onPress={() => onKey('8')} />
          <Key label="9" onPress={() => onKey('9')} />
        </View>
        <View className="flex-row">
          <Key label="." onPress={() => onKey('.')} />
          <Key label="0" onPress={() => onKey('0')} />
          <Key
            onPress={onBackspace}
            icon={
              <Ionicons name="backspace-outline" size={26} color="#0a0a0a" />
            }
          />
        </View>
      </View>

      <View className="px-6 pb-6">
        <Button
          onPress={onNext}
          isDisabled={!meetsMin}
          size="lg"
          className="rounded-full bg-foreground"
        >
          <View className="flex-row items-end gap-1">
            <Text className="text-base font-semibold text-background">
              {meetsMin ? `Charge ${formatAmount(parsed)}` : `${MIN_AMOUNT} minimum`}
            </Text>
            <Text className="text-xs font-semibold text-background opacity-80">
              RON
            </Text>
          </View>
        </Button>
      </View>
    </View>
  );
}

function TapStep({
  amount,
  isScanning,
  isSubmitting,
  onTap,
  onCancel,
  error,
}: {
  amount: number;
  isScanning: boolean;
  isSubmitting: boolean;
  onTap: () => void;
  onCancel: () => void;
  error: string | null;
}) {
  const busy = isScanning || isSubmitting;
  return (
    <View className="flex-1 px-5 bg-background">
      <View className="self-start rounded-full bg-surface px-3 py-1.5">
        <Text className="text-xs font-medium text-muted">
          Charging {formatAmount(amount)} RON
        </Text>
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
              ? 'Charging bracelet'
              : 'Hold the bracelet near the phone'}
        </Text>
        <Text className="mt-2 text-sm text-white/70 text-center">
          {isScanning
            ? 'Keep the wristband still on the back of the device'
            : 'The amount will be deducted from their wallet'}
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
  amount,
  onAgain,
}: {
  amount: number;
  onAgain: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="flex-1 items-center justify-center px-8 bg-background"
    >
      <Animated.View
        entering={ZoomIn.springify().damping(12).mass(0.6)}
        className="h-24 w-24 items-center justify-center rounded-full bg-success"
      >
        <Ionicons name="checkmark" size={56} color="#ffffff" />
      </Animated.View>
      <Animated.Text
        entering={FadeIn.delay(220).duration(220)}
        className="mt-6 text-2xl font-bold text-foreground"
      >
        Charged
      </Animated.Text>
      <View className="mt-2 flex-row items-end gap-1">
        <Text className="text-base text-muted">{formatAmount(amount)}</Text>
        <Text className="text-xs text-muted">RON</Text>
      </View>

      <View className="mt-8 w-full gap-3">
        <Pressable
          onPress={onAgain}
          className="rounded-2xl bg-foreground px-5 py-4 items-center"
        >
          <Text className="text-base font-semibold text-background">
            New charge
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/home')}
          className="rounded-2xl bg-surface px-5 py-4 items-center"
        >
          <Text className="text-base font-semibold text-foreground">Done</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function NotAVendorScope() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/home'), 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-base font-semibold text-foreground">
          Pick a vendor scope first
        </Text>
        <Text className="mt-2 text-center text-sm text-muted">
          Charges run against a specific vendor stand. Switch to a vendor
          scope from the home screen.
        </Text>
      </View>
    </Screen>
  );
}

function Key({
  label,
  icon,
  onPress,
}: {
  label?: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
      className="flex-1 items-center justify-center py-5"
    >
      {icon ?? (
        <Text className="text-3xl font-medium text-foreground">{label}</Text>
      )}
    </Pressable>
  );
}

function AnimatedAmount({ value }: { value: string }) {
  const formatted = formatWithCommas(value);
  return (
    <Animated.View layout={LinearTransition.duration(160)} className="flex-row">
      {formatted.split('').map((char, idx) => (
        <Animated.Text
          key={`${idx}-${char}`}
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(120)}
          layout={LinearTransition.duration(160)}
          className="text-6xl font-bold text-foreground tracking-tight"
        >
          {char}
        </Animated.Text>
      ))}
    </Animated.View>
  );
}

function formatWithCommas(amount: string): string {
  if (amount.length === 0) return '0';
  const [intPart, decPart] = amount.split('.');
  const intNum = parseInt(intPart || '0', 10);
  const intFormatted = Number.isFinite(intNum)
    ? intNum.toLocaleString('en-US')
    : intPart || '0';
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
}

function formatAmount(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('en-US');
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
