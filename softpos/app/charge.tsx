import { useCallback, useEffect, useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { extractErrorMessage } from "@/lib/api";
import {
  type ChargeResponse,
  transactionsApi,
} from "@/lib/api/transactions";
import { type ChipState } from "@/lib/chip";
import { getOrCreateLocalDeviceId } from "@/lib/device-id";
import { newIdempotencyKey } from "@/lib/idempotency";
import { useQueue } from "@/lib/offline";
import { Screen, NfcPulse } from "@/components/ui";
import { useScope } from "@/hooks/use-scope";
import { useNfc } from "@/hooks/use-nfc";

type Mode = "online" | "offline";
type Step = "amount" | "tap" | "submitting" | "done";

type DoneInfo = {
  amount: number;
  mode: Mode;
};

const MIN_AMOUNT = 1;

export default function ChargeScreen() {
  const { scope } = useScope();
  const queryClient = useQueryClient();
  const queue = useQueue();
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const nfc = useNfc();

  const vendor = scope?.kind === "vendor" ? scope.vendor : null;
  const parsed = parseFloat(amount || "0");
  const meetsMin = parsed >= MIN_AMOUNT;
  const amountCents = Math.round(parsed * 100);

  const onlineCharge = useMutation({
    mutationFn: async (input: {
      uid: string;
      chipState: ChipState | null;
    }): Promise<{ resp: ChargeResponse; uid: string }> => {
      if (!vendor) throw new Error("No vendor scope");
      const resp = await transactionsApi.charge(
        vendor.eventId,
        vendor.vendorId,
        {
          wristbandUid: input.uid,
          amount: amountCents,
          deviceId: getOrCreateLocalDeviceId(),
          idempotencyKey: newIdempotencyKey(),
          clientTimestamp: new Date().toISOString(),
          metadata: { vendorName: vendor.businessName },
        },
      );
      return { resp, uid: input.uid };
    },
    onSuccess: async ({ resp, uid }) => {
      const newChipState: ChipState = {
        balance: resp.chipShouldWrite.balance,
        debitCounter: resp.bracelet.debit_counter_seen,
        creditCounterSeen: resp.chipShouldWrite.credit_counter,
      };
      const writeResult = await nfc.writeChipState(uid, newChipState);
      if (writeResult.kind === "error") {
        setError(
          `Charge succeeded but chip update failed: ${writeResult.error}`,
        );
      }
      setDone({ amount: parsed, mode: "online" });
      setStep("done");
      if (vendor) {
        queryClient.invalidateQueries({
          queryKey: ["vendor-tx", vendor.eventId, vendor.vendorId],
        });
      }
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
      setStep("tap");
    },
  });

  const handleOfflineCharge = useCallback(
    async (uid: string, chipState: ChipState) => {
      if (!vendor) return;
      if (chipState.balance < amountCents) {
        setError("Insufficient funds on bracelet");
        setStep("tap");
        return;
      }
      const newDebitCounter = chipState.debitCounter + 1;
      const newChipState: ChipState = {
        balance: chipState.balance - amountCents,
        debitCounter: newDebitCounter,
        creditCounterSeen: chipState.creditCounterSeen,
      };
      const writeResult = await nfc.writeChipState(uid, newChipState);
      if (writeResult.kind !== "ok") {
        setError(
          writeResult.kind === "error"
            ? writeResult.error
            : "Chip write canceled",
        );
        setStep("tap");
        return;
      }
      try {
        await queue.appendDebit({
          wire: {
            idempotencyKey: newIdempotencyKey(),
            amount: amountCents,
            vendorId: vendor.vendorId,
            counterValue: newDebitCounter,
            deviceId: getOrCreateLocalDeviceId(),
            clientTimestamp: new Date().toISOString(),
          },
          enqueuedAt: new Date().toISOString(),
          wristbandUid: uid,
          status: "pending",
        });
      } catch (e) {
        setError(extractErrorMessage(e));
        setStep("tap");
        return;
      }
      setDone({ amount: parsed, mode: "offline" });
      setStep("done");
    },
    [vendor, amountCents, parsed, nfc, queue],
  );

  const tap = useCallback(async () => {
    if (!nfc.isAvailable) {
      setError("This device does not support NFC.");
      return;
    }
    setError(null);
    const res = await nfc.readBracelet();

    if (res.kind === "canceled") return;
    if (res.kind === "error") {
      setError(res.error);
      return;
    }

    if (res.kind === "blank") {
      if (!queue.isOnline) {
        setError(
          res.reason === "uninitialized"
            ? "Bracelet not initialized. Connect to network first to set it up."
            : "Bracelet signature does not match. Cannot charge offline.",
        );
        return;
      }
      setStep("submitting");
      onlineCharge.mutate({ uid: res.uid, chipState: null });
      return;
    }

    if (queue.isOnline) {
      setStep("submitting");
      onlineCharge.mutate({ uid: res.uid, chipState: res.chipState });
    } else {
      setStep("submitting");
      await handleOfflineCharge(res.uid, res.chipState);
    }
  }, [nfc, queue.isOnline, onlineCharge, handleOfflineCharge]);

  function next() {
    if (!meetsMin) return;
    setError(null);
    setStep("tap");
    void tap();
  }

  function startOver() {
    setAmount("");
    setDone(null);
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

  if (!vendor) {
    return <NotAVendorScope />;
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
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
        <ConnectivityPill online={queue.isOnline} />
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

      {step === "tap" || step === "submitting" ? (
        <TapStep
          isScanning={nfc.isBusy}
          isSubmitting={step === "submitting"}
          isOnline={queue.isOnline}
          onScan={tap}
          onCancel={nfc.cancel}
          error={error}
        />
      ) : null}

      {step === "done" && done ? (
        <DoneStep info={done} onAgain={startOver} />
      ) : null}
    </Screen>
  );
}

function ConnectivityPill({ online }: { online: boolean }) {
  return (
    <View
      className={`rounded-full px-3 py-1 ${
        online ? "bg-surface" : "bg-warning/20"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          online ? "text-muted" : "text-warning"
        }`}
      >
        {online ? "Online" : "Offline"}
      </Text>
    </View>
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
              {meetsMin
                ? `Charge ${formatAmount(parsed)}`
                : `${MIN_AMOUNT} minimum`}
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
  isScanning,
  isSubmitting,
  isOnline,
  onScan,
  onCancel,
  error,
}: {
  isScanning: boolean;
  isSubmitting: boolean;
  isOnline: boolean;
  onScan: () => void;
  onCancel: () => void;
  error: string | null;
}) {
  const idle = !isScanning && !isSubmitting;
  return (
    <View className="flex-1 px-5 bg-background">
      <View className="mt-5 overflow-hidden rounded-3xl px-6 py-10 items-center">
        <View className="h-72 w-72 items-center justify-center">
          <NfcPulse active={isScanning} />
          <View className="h-32 w-32 items-center justify-center rounded-full bg-white/10 border border-white/20">
            <Ionicons
              name="wifi"
              size={56}
              color="#ffffff"
              style={{ transform: [{ rotate: "-90deg" }] }}
            />
          </View>
        </View>

        <Text className="mt-2 text-xl font-semibold text-white text-center">
          {isScanning
            ? "Scanning..."
            : isSubmitting
              ? isOnline
                ? "Charging bracelet"
                : "Saving offline charge"
              : "Hold the bracelet near the phone"}
        </Text>
        <Text className="mt-2 text-sm text-white/70 text-center">
          {isScanning
            ? "Keep the wristband still on the back of the device"
            : isOnline
              ? "The amount will be deducted from their wallet"
              : "Offline mode: debit will sync when network returns"}
        </Text>
      </View>

      {error ? (
        <Text className="mt-4 text-center text-sm text-danger">{error}</Text>
      ) : null}

      {idle && error ? (
        <View className="px-1 pb-6 mt-auto">
          <Button
            onPress={onScan}
            size="lg"
            className="rounded-full bg-foreground"
          >
            <Text className="text-base font-semibold text-background">
              Tap again
            </Text>
          </Button>
        </View>
      ) : null}

      {isScanning ? (
        <View className="px-1 pb-6 mt-auto">
          <Pressable onPress={onCancel} className="items-center py-3">
            <Text className="text-sm font-medium text-white/70">Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function DoneStep({
  info,
  onAgain,
}: {
  info: DoneInfo;
  onAgain: () => void;
}) {
  const offline = info.mode === "offline";
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="flex-1 items-center justify-center px-8 bg-background"
    >
      <Animated.View
        entering={ZoomIn.springify().damping(12).mass(0.6)}
        className={`h-24 w-24 items-center justify-center rounded-full ${
          offline ? "bg-warning" : "bg-success"
        }`}
      >
        <Ionicons
          name={offline ? "cloud-offline" : "checkmark"}
          size={56}
          color="#ffffff"
        />
      </Animated.View>
      <Animated.Text
        entering={FadeIn.delay(220).duration(220)}
        className="mt-6 text-2xl font-bold text-foreground"
      >
        {offline ? "Saved offline" : "Charged"}
      </Animated.Text>
      <View className="mt-2 flex-row items-end gap-1">
        <Text className="text-base text-muted">{formatAmount(info.amount)}</Text>
        <Text className="text-xs text-muted">RON</Text>
      </View>
      {offline ? (
        <Text className="mt-3 text-center text-sm text-muted">
          Will sync when network returns or you tap the bracelet again online.
        </Text>
      ) : null}

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
          onPress={() => router.replace("/home")}
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
    const t = setTimeout(() => router.replace("/home"), 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-base font-semibold text-foreground">
          Pick a vendor scope first
        </Text>
        <Text className="mt-2 text-center text-sm text-muted">
          Charges run against a specific vendor stand. Switch to a vendor scope
          from the home screen.
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
