import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui';

export function VendorHome() {
  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <View className="w-10" />
          <Text className="text-[18px] font-semibold text-foreground">
            Vendor
          </Text>
          <View className="w-10" />
        </View>

        <View className="px-5">
          <Text className="text-[22px] font-bold text-foreground">
            Accept payments
          </Text>
          <Text className="mt-1 text-[13px] text-muted">
            Charge an attendee bracelet for sold items.
          </Text>

          <Pressable className="mt-6 rounded-2xl bg-foreground px-6 py-5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-background">
                <Ionicons name="card-outline" size={20} color="#0a0a0a" />
              </View>
              <View>
                <Text className="text-[16px] font-semibold text-background">
                  New charge
                </Text>
                <Text className="mt-0.5 text-[12px] text-muted">
                  Tap to start a payment
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>

          <View className="mt-6 rounded-2xl bg-surface px-5 py-5">
            <Text className="text-[14px] font-semibold text-foreground">
              Today's sales
            </Text>
            <Text className="mt-2 text-[12px] text-muted">
              Your sales summary will appear here.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
