import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { APP_CURRENCY } from "@/lib/format";
import { ChipDebug } from "./chip-debug";
import { formatAmount } from "./format";
import { type DoneInfo } from "./types";

export function DoneStep({
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
        <Text className="text-xs text-muted">{APP_CURRENCY}</Text>
      </View>
      {offline ? (
        <Text className="mt-3 text-center text-sm text-muted">
          Will sync when network returns or you tap the bracelet again online.
        </Text>
      ) : null}

      {info.chipState ? (
        <ChipDebug
          label={offline ? "Chip state after debit" : "Chip state"}
          state={info.chipState}
        />
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
