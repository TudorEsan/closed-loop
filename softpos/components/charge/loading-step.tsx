import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

export function LoadingStep({ isOnline }: { isOnline: boolean }) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="flex-1 items-center justify-center px-8 bg-background"
    >
      <View className="h-24 w-24 items-center justify-center rounded-full bg-surface border border-foreground/10">
        <ActivityIndicator size="large" color="#0a0a0a" />
      </View>
      <Animated.Text
        entering={FadeIn.delay(120).duration(220)}
        className="mt-6 text-2xl font-bold text-foreground text-center"
      >
        {isOnline ? "Processing charge" : "Saving offline charge"}
      </Animated.Text>
      <Text className="mt-3 text-center text-sm text-muted">
        {isOnline
          ? "Sending the debit to the server, hold on"
          : "Writing the chip and queuing the debit"}
      </Text>
    </Animated.View>
  );
}
