import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { NfcPulse } from "@/components/ui";

export function TapStep({
  mode = "read",
  isScanning,
  isOnline,
  onCancel,
}: {
  mode?: "read" | "write";
  isScanning: boolean;
  isOnline: boolean;
  onCancel: () => void;
}) {
  const isWrite = mode === "write";
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
          {isScanning
            ? "Scanning..."
            : isWrite
              ? "Tap the bracelet again"
              : "Hold the bracelet near the phone"}
        </Text>
        <Text className="mt-2 text-sm text-muted text-center">
          {isScanning
            ? "Keep the wristband still on the back of the device"
            : isWrite
              ? "Updating the chip with the new balance"
              : isOnline
                ? "The amount will be deducted from their wallet"
                : "Offline mode: debit will sync when network returns"}
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
