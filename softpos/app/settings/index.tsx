import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { MenuRow, Screen } from "@/components/ui";
import { useQueue } from "@/lib/offline";

export default function SettingsScreen() {
  const queue = useQueue();
  const pendingBadge =
    queue.pendingCount > 0 ? String(queue.pendingCount) : undefined;

  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
          >
            <Ionicons name="chevron-back" size={20} color="#0a0a0a" />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">
            Settings
          </Text>
          <View className="h-9 w-9" />
        </View>

        <View className="px-4">
          <View className="overflow-hidden rounded-2xl bg-surface">
            <MenuRow
              icon="sync-outline"
              label="Sync and offline"
              subtitle={
                queue.scope
                  ? queue.isOnline
                    ? "Online"
                    : "Offline"
                  : "Vendor scope only"
              }
              badge={pendingBadge}
              onPress={() => router.push("/settings/sync")}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
