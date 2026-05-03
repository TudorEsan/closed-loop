import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { extractErrorMessage } from "@/lib/api";
import { APP_CURRENCY } from "@/lib/format";
import { useTopUp } from "@/hooks";
import { Button } from "heroui-native";

const MIN_AMOUNT = 5;

export default function TopUpScreen() {
  const params = useLocalSearchParams<{ braceletId?: string }>();
  const braceletId = params.braceletId ?? null;

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const topUpMutation = useTopUp({
    onSuccess: () => {
      setShowSuccess(true);
    },
    onCanceled: () => {
      setError(null);
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
    },
  });

  useEffect(() => {
    if (!showSuccess) return;
    const timeout = setTimeout(() => {
      router.back();
    }, 1600);
    return () => clearTimeout(timeout);
  }, [showSuccess]);

  const parsedAmount = parseFloat(amount || "0");
  const meetsMinimum = parsedAmount >= MIN_AMOUNT;
  const isDisabled = !meetsMinimum || !braceletId || topUpMutation.isPending;

  function handleKeyPress(key: string) {
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
      const next = prev + key;
      if (parseFloat(next) > 9999) return prev;
      return next;
    });
  }

  function handleBackspace() {
    setError(null);
    setAmount((prev) => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (!meetsMinimum || !braceletId) return;
    topUpMutation.mutate({
      eventBraceletId: braceletId,
      amountCents: Math.round(parsedAmount * 100),
    });
  }

  const displayAmount = amount.length === 0 ? "0" : amount;

  return (
    <View className="flex-1 ">
      <View className="flex-1 items-center justify-center px-6">
        <View className="flex-row items-end gap-2">
          <AnimatedAmount value={displayAmount} />
          <Text className="text-4xl font-bold text-foreground">
            {APP_CURRENCY}
          </Text>
        </View>

        {error ? (
          <Text className="mt-4 text-center text-sm text-danger">
            {error}
          </Text>
        ) : null}
      </View>

      <View className="px-6 pb-4">
        <View className="flex-row">
          <KeypadKey label="1" onPress={() => handleKeyPress("1")} />
          <KeypadKey label="2" onPress={() => handleKeyPress("2")} />
          <KeypadKey label="3" onPress={() => handleKeyPress("3")} />
        </View>
        <View className="flex-row">
          <KeypadKey label="4" onPress={() => handleKeyPress("4")} />
          <KeypadKey label="5" onPress={() => handleKeyPress("5")} />
          <KeypadKey label="6" onPress={() => handleKeyPress("6")} />
        </View>
        <View className="flex-row">
          <KeypadKey label="7" onPress={() => handleKeyPress("7")} />
          <KeypadKey label="8" onPress={() => handleKeyPress("8")} />
          <KeypadKey label="9" onPress={() => handleKeyPress("9")} />
        </View>
        <View className="flex-row">
          <KeypadKey label="." onPress={() => handleKeyPress(".")} />
          <KeypadKey label="0" onPress={() => handleKeyPress("0")} />
          <KeypadKey
            onPress={handleBackspace}
            icon={
              <Ionicons name="backspace-outline" size={26} color="#0a0a0a" />
            }
          />
        </View>
      </View>

      <View className="px-6 pb-6">
        <Button
          onPress={handleSubmit}
          isDisabled={isDisabled}
          size="lg"
          className="rounded-full bg-foreground"
        >
          {topUpMutation.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : !braceletId ? (
            <Text className="text-base font-semibold text-background">
              Pick a bracelet first
            </Text>
          ) : (
            <View className="flex-row items-end gap-1">
              <Text className="text-base font-semibold text-background">
                {meetsMinimum
                  ? `Add ${formatAmount(parsedAmount)}`
                  : `${MIN_AMOUNT} minimum`}
              </Text>
              <Text className="text-xs font-semibold text-background opacity-80">
                {APP_CURRENCY}
              </Text>
            </View>
          )}
        </Button>
      </View>

      {showSuccess ? (
        <SuccessOverlay amount={formatAmount(parsedAmount)} />
      ) : null}
    </View>
  );
}

function SuccessOverlay({ amount }: { amount: string }) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="absolute inset-0 items-center justify-center bg-background"
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

      <Animated.View
        entering={FadeIn.delay(280).duration(220)}
        className="mt-2 flex-row items-end gap-1"
      >
        <Text className="text-base text-muted">{amount}</Text>
        <Text className="text-xs text-muted">{APP_CURRENCY}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function KeypadKey({
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
  const chars = formatted.split("");

  return (
    <Animated.View layout={LinearTransition.duration(160)} className="flex-row">
      {chars.map((char, idx) => (
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
