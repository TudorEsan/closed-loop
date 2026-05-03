import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { extractErrorMessage } from "@/lib/api";
import { transactionsApi } from "@/lib/api/transactions";
import { type ChipState } from "@/lib/chip";
import { getOrCreateLocalDeviceId } from "@/lib/device-id";
import { formatMoney } from "@/lib/format";
import { newIdempotencyKey } from "@/lib/idempotency";
import { useQueue } from "@/lib/offline";
import { Screen } from "@/components/ui";
import {
  AmountStep,
  ConnectivityPill,
  DoneStep,
  ErrorStep,
  LoadingStep,
  MIN_AMOUNT,
  NotAVendorScope,
  TapStep,
  blankMessage,
  type DoneInfo,
  type Mode,
  type NfcFailure,
  type Step,
} from "@/components/charge";
import { useScope } from "@/hooks/use-scope";
import { useNfc } from "@/hooks/use-nfc";

export default function ChargeScreen() {
  const { scope } = useScope();
  const queryClient = useQueryClient();
  const queue = useQueue();
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorChipState, setErrorChipState] = useState<ChipState | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const nfc = useNfc();

  const vendor = scope?.kind === "vendor" ? scope.vendor : null;
  const parsed = parseFloat(amount || "0");
  const meetsMin = parsed >= MIN_AMOUNT;
  const amountCents = Math.round(parsed * 100);

  const tap = useCallback(async () => {
    if (!nfc.isAvailable) {
      setError("This device does not support NFC.");
      return;
    }
    if (!vendor) return;
    setError(null);
    console.log(
      `[charge] tap start online=${queue.isOnline} amount=${amountCents}`,
    );

    const applyFailure = (
      res: NfcFailure,
      mode: Mode,
      abortOverride: string | null = null,
    ) => {
      if (res.kind === "canceled") return;
      if (res.kind === "error") setError(res.error);
      else if (res.kind === "blank") setError(blankMessage(res.reason, mode));
      else {
        setError(abortOverride ?? res.reason);
        setErrorChipState(res.prev);
      }
      setStep("error");
    };

    if (queue.isOnline) {
      let chargeError: string | null = null;
      const res = await nfc.readWriteBracelet(async (state, uid) => {
        try {
          const resp = await transactionsApi.charge(
            vendor.eventId,
            vendor.vendorId,
            {
              wristbandUid: uid,
              amount: amountCents,
              deviceId: getOrCreateLocalDeviceId(),
              idempotencyKey: newIdempotencyKey(),
              chipState: {
                balance: state.balance,
                debit_counter: state.debitCounter,
                credit_counter_seen: state.creditCounterSeen,
              },
            },
          );
          return {
            balance: resp.chipShouldWrite.balance,
            debitCounter: resp.bracelet.debit_counter_seen,
            creditCounterSeen: resp.chipShouldWrite.credit_counter,
          };
        } catch (e) {
          chargeError = extractErrorMessage(e);
          return { abort: chargeError };
        }
      });
      console.log(`[charge] online readWriteBracelet -> kind=${res.kind}`);
      if (res.kind !== "ok") {
        applyFailure(res, "online", chargeError);
        return;
      }
      setDone({ amount: parsed, mode: "online", chipState: res.next });
      setStep("done");
      queryClient.invalidateQueries({
        queryKey: ["vendor-tx", vendor.eventId, vendor.vendorId],
      });
      return;
    }

    const res = await nfc.readWriteBracelet((state) => {
      if (state.balance < amountCents) {
        return {
          abort: `Insufficient balance. Available: ${formatMoney(state.balance)}.`,
        };
      }
      return {
        balance: state.balance - amountCents,
        debitCounter: state.debitCounter + 1,
        creditCounterSeen: state.creditCounterSeen,
      };
    });
    console.log(`[charge] readWriteBracelet -> kind=${res.kind}`);
    if (res.kind !== "ok") {
      applyFailure(res, "offline");
      return;
    }

    setStep("submitting");
    try {
      await queue.appendDebit({
        wire: {
          idempotencyKey: newIdempotencyKey(),
          amount: amountCents,
          vendorId: vendor.vendorId,
          counterValue: res.next.debitCounter,
          deviceId: getOrCreateLocalDeviceId(),
          clientTimestamp: new Date().toISOString(),
        },
        enqueuedAt: new Date().toISOString(),
        wristbandUid: res.uid,
        status: "pending",
      });
    } catch (e) {
      setError(extractErrorMessage(e));
      setStep("error");
      return;
    }
    setDone({ amount: parsed, mode: "offline", chipState: res.next });
    setStep("done");
  }, [nfc, queue, vendor, amountCents, parsed, queryClient]);

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
    setErrorChipState(null);
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
        <ConnectivityPill
          online={queue.isOnline}
          forced={queue.forceOffline}
          onToggle={() => queue.setForceOffline(!queue.forceOffline)}
        />
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
        <TapStep
          isScanning={nfc.isBusy}
          isOnline={queue.isOnline}
          onCancel={nfc.cancel}
        />
      ) : null}

      {step === "submitting" ? (
        <LoadingStep isOnline={queue.isOnline} />
      ) : null}

      {step === "error" ? (
        <ErrorStep
          message={error ?? "Something went wrong"}
          chipState={errorChipState}
          onRetry={() => {
            setError(null);
            setErrorChipState(null);
            setStep("tap");
            void tap();
          }}
          onCancel={startOver}
        />
      ) : null}

      {step === "done" && done ? (
        <DoneStep info={done} onAgain={startOver} />
      ) : null}
    </Screen>
  );
}
