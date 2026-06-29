import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "heroui-native";

import { Screen, NfcPulse } from "@/components/ui";
import { extractErrorMessage } from "@/lib/api";
import { APP_CURRENCY } from "@/lib/format";
import { transactionsApi } from "@/lib/api/transactions";
import { getOrCreateLocalDeviceId } from "@/lib/device-id";
import { newIdempotencyKey } from "@/lib/idempotency";
import { useScope } from "@/hooks/use-scope";
import { useNfc } from "@/hooks/use-nfc";
import { useQueue } from "@/lib/offline";

const MIN_AMOUNT = 1;

type Step = "amount" | "tap" | "done" | "error";

export default function CashTopupScreen() {
  const { scope } = useScope();
  const queue = useQueue();
  const nfc = useNfc();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creditedAmount, setCreditedAmount] = useState(0);

  const eventId = scope?.kind === "event" ? scope.event.eventId : null;
  const parsed = parseFloat(amount || "0");
  const meetsMin = parsed >= MIN_AMOUNT;
  const amountCents = Math.round(parsed * 100);

  const tap = useCallback(async () => {
    if (!eventId) return;
    if (!nfc.isAvailable) {
      setError("This device does not support NFC.");
      setStep("error");
      return;
    }
    // Crediting a chip without a confirmed server record would mint funds, so
    // cash top-up is online-only. The chip is written from the server response.
    if (!queue.isOnline) {
      setError(
        "Cash top-up needs a connection. Reconnect this terminal and try again.",
      );
      setStep("error");
      return;
    }
    setError(null);

    let topupError: string | null = null;
    const res = await nfc.readWriteBracelet(async (state, uid) => {
      try {
        const resp = await transactionsApi.cashTopup(eventId, {
          wristbandUid: uid,
          amount: amountCents,
          deviceId: getOrCreateLocalDeviceId(),
          idempotencyKey: newIdempotencyKey(),
          chipState: {
            balance: state.balance,
            debit_counter: state.debitCounter,
            credit_counter_seen: state.creditCounterSeen,
          },
        });
        return {
          balance: resp.chipShouldWrite.balance,
          debitCounter: state.debitCounter,
          creditCounterSeen: resp.chipShouldWrite.credit_counter,
        };
      } catch (e) {
        topupError = extractErrorMessage(e);
        return { abort: topupError };
      }
    });

    if (res.kind === "ok") {
      setCreditedAmount(parsed);
      setStep("done");
      return;
    }
    if (res.kind === "canceled") {
      setStep("amount");
      return;
    }
    if (res.kind === "aborted") {
      setError(topupError ?? res.reason);
    } else if (res.kind === "blank") {
      setError("Bracelet not initialized. Link it first.");
    } else {
      setError(res.error);
    }
    setStep("error");
  }, [eventId, nfc, queue.isOnline, amountCents, parsed]);

  function next() {
    if (!meetsMin) return;
    setError(null);
    setStep("tap");
    void tap();
  }

  function startOver() {
    setAmount("");
    setCreditedAmount(0);
    setError(null);
    setStep("amount");
  }

  function handleKey(key: string) {
    setError(null);
    setAmount((prev) => {
      if (key === ".") {
        if (prev.includes(".")) return prev;
        if (prev.length === 0) return "0.";
        return prev + ".";
      }
      if (prev.includes(".")) {
        const decimals = prev.split(".")[1] ?? "";
        if (decimals.length >= 2) return prev;
      }
      if (prev === "0") return key;
      const nextVal = prev + key;
      if (parseFloat(nextVal) > 9999) return prev;
      return nextVal;
    });
  }

  function handleBackspace() {
    setError(null);
    setAmount((prev) => prev.slice(0, -1));
  }

  if (!eventId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base font-semibold text-foreground">
            Switch to an event to take cash top-ups
          </Text>
          <Pressable onPress={() => router.back()} className="mt-6">
            <Text className="text-sm font-medium text-muted">Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#0a0a0a" />
        </Pressable>
        <Text className="ml-2 text-lg font-semibold text-foreground">
          Cash top-up
        </Text>
      </View>

      {step === "amount" ? (
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

      {step === "tap" ? (
        <TapStep isScanning={nfc.isBusy} onCancel={nfc.cancel} />
      ) : null}

      {step === "done" ? (
        <DoneStep amount={creditedAmount} onAgain={startOver} />
      ) : null}

      {step === "error" ? (
        <ErrorStep
          message={error ?? "Something went wrong"}
          onRetry={() => {
            setError(null);
            setStep("tap");
            void tap();
          }}
          onCancel={startOver}
        />
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
  const display = amount.length === 0 ? "0" : amount;
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center px-6">
        <View className="flex-row items-end gap-2">
          <AnimatedAmount value={display} />
          <Text className="text-3xl font-bold text-foreground">
            {APP_CURRENCY}
          </Text>
        </View>
        {error ? (
          <Text className="mt-4 text-center text-sm text-danger">{error}</Text>
        ) : null}
      </View>

      <View className="px-6 pb-4">
        <View className="flex-row">
          <Key label="1" onPress={() => onKey("1")} />
          <Key label="2" onPress={() => onKey("2")} />
          <Key label="3" onPress={() => onKey("3")} />
        </View>
        <View className="flex-row">
          <Key label="4" onPress={() => onKey("4")} />
          <Key label="5" onPress={() => onKey("5")} />
          <Key label="6" onPress={() => onKey("6")} />
        </View>
        <View className="flex-row">
          <Key label="7" onPress={() => onKey("7")} />
          <Key label="8" onPress={() => onKey("8")} />
          <Key label="9" onPress={() => onKey("9")} />
        </View>
        <View className="flex-row">
          <Key label="." onPress={() => onKey(".")} />
          <Key label="0" onPress={() => onKey("0")} />
          <Key
            onPress={onBackspace}
            icon={<Ionicons name="backspace-outline" size={26} color="#0a0a0a" />}
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
              {meetsMin ? `Add ${formatAmount(parsed)}` : `${MIN_AMOUNT} minimum`}
            </Text>
            <Text className="text-xs font-semibold text-background opacity-80">
              {APP_CURRENCY}
            </Text>
          </View>
        </Button>
      </View>
    </View>
  );
}

function TapStep({
  isScanning,
  onCancel,
}: {
  isScanning: boolean;
  onCancel: () => void;
}) {
  return (
    <View className="flex-1 px-5 bg-background">
      <View className="mt-5 overflow-hidden rounded-3xl px-6 py-10 items-center">
        <View className="h-72 w-72 items-center justify-center">
          <NfcPulse active={isScanning} />
          <View className="h-32 w-32 items-center justify-center rounded-full bg-surface border border-foreground/10">
            <Ionicons
              name="wifi"
              size={56}
              color="#0a0a0a"
              style={{ transform: [{ rotate: "-90deg" }] }}
            />
          </View>
        </View>

        <Text className="mt-2 text-xl font-semibold text-foreground text-center">
          {isScanning ? "Scanning..." : "Hold the bracelet near the phone"}
        </Text>
        <Text className="mt-2 text-sm text-muted text-center">
          {isScanning
            ? "Keep the wristband still on the back of the device"
            : "The amount will be added to their wallet"}
        </Text>
      </View>

      {isScanning ? (
        <View className="px-1 pb-6 mt-auto">
          <Pressable onPress={onCancel} className="items-center py-3">
            <Text className="text-sm font-medium text-muted">Cancel</Text>
          </Pressable>
        </View>
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
        Funds added
      </Animated.Text>
      <View className="mt-2 flex-row items-end gap-1">
        <Text className="text-base text-muted">{formatAmount(amount)}</Text>
        <Text className="text-xs text-muted">{APP_CURRENCY}</Text>
      </View>

      <View className="mt-8 w-full gap-3">
        <Pressable
          onPress={onAgain}
          className="rounded-2xl bg-foreground px-5 py-4 items-center"
        >
          <Text className="text-base font-semibold text-background">
            New top-up
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/home")}
          className="rounded-2xl bg-surface px-5 py-4 items-center"
        >
          <Text className="text-base font-semibold text-foreground">Done</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function ErrorStep({
  message,
  onRetry,
  onCancel,
}: {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="flex-1 items-center justify-center px-8 bg-background"
    >
      <Animated.View
        entering={ZoomIn.springify().damping(12).mass(0.6)}
        className="h-24 w-24 items-center justify-center rounded-full bg-danger"
      >
        <Ionicons name="close" size={56} color="#ffffff" />
      </Animated.View>
      <Animated.Text
        entering={FadeIn.delay(220).duration(220)}
        className="mt-6 text-2xl font-bold text-foreground text-center"
      >
        Top-up failed
      </Animated.Text>
      <Text className="mt-3 text-center text-sm text-muted">{message}</Text>

      <View className="mt-8 w-full gap-3">
        <Pressable
          onPress={onRetry}
          className="rounded-2xl bg-foreground px-5 py-4 items-center"
        >
          <Text className="text-base font-semibold text-background">
            Try again
          </Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          className="rounded-2xl bg-surface px-5 py-4 items-center"
        >
          <Text className="text-base font-semibold text-foreground">Cancel</Text>
        </Pressable>
      </View>
    </Animated.View>
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
      android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
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
      {formatted.split("").map((char, idx) => (
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
  if (amount.length === 0) return "0";
  const [intPart, decPart] = amount.split(".");
  const intNum = parseInt(intPart || "0", 10);
  const intFormatted = Number.isFinite(intNum)
    ? intNum.toLocaleString("en-US")
    : intPart || "0";
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
}

function formatAmount(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
