import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui';

export function OperatorHome() {
  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <View className="w-10" />
          <Text className="text-[18px] font-semibold text-foreground">
            Operator
          </Text>
          <View className="w-10" />
        </View>

        <View className="px-5">
          <Text className="text-[22px] font-bold text-foreground">
            Top up bracelets
          </Text>
          <Text className="mt-1 text-[13px] text-muted">
            Tap an attendee bracelet to load cash onto their wallet.
          </Text>

          <Pressable
            onPress={() => router.push('/topup')}
            className="mt-6 rounded-2xl bg-foreground px-6 py-5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-background">
                <Ionicons name="cash-outline" size={20} color="#0a0a0a" />
              </View>
              <View>
                <Text className="text-base font-semibold text-background">
                  Cash top-up
                </Text>
                <Text className="mt-0.5 text-xs text-muted">
                  Accept cash, credit bracelet
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>

          <Pressable
            onPress={() => router.push('/link-bracelet')}
            className="mt-3 rounded-2xl bg-surface px-6 py-5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
                <Ionicons name="link-outline" size={20} color="#0a0a0a" />
              </View>
              <View>
                <Text className="text-base font-semibold text-foreground">
                  Link bracelet
                </Text>
                <Text className="mt-0.5 text-xs text-muted">
                  Scan attendee QR, tap their wristband
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>

          <View className="mt-6 rounded-2xl bg-surface px-5 py-5">
            <Text className="text-[14px] font-semibold text-foreground">
              Today
            </Text>
            <Text className="mt-2 text-[12px] text-muted">
              Your top-up history will appear here.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
