import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { type ChipState } from "@/lib/chip";
import { ChipDebug } from "./chip-debug";

export function ErrorStep({
  message,
  chipState,
  onRetry,
  onCancel,
}: {
  message: string;
  chipState: ChipState | null;
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
        Charge failed
      </Animated.Text>
      <Text className="mt-3 text-center text-sm text-muted">{message}</Text>

      {chipState ? (
        <ChipDebug label="Chip state" state={chipState} />
      ) : null}

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
          <Text className="text-base font-semibold text-foreground">
            Cancel
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
