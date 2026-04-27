import { useEffect } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { Screen } from "@/components/ui";

export function NotAVendorScope() {
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
