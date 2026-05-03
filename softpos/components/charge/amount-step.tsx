import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "heroui-native";

import { APP_CURRENCY } from "@/lib/format";
import { formatAmount, formatWithCommas } from "./format";
import { MIN_AMOUNT } from "./types";

export function AmountStep({
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
              {APP_CURRENCY}
            </Text>
          </View>
        </Button>
      </View>
    </View>
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
