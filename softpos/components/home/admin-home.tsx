import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui';

export function AdminHome({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <View className="w-10" />
          <Text className="text-[18px] font-semibold text-foreground">
            {isSuperAdmin ? 'Super Admin' : 'Admin'}
          </Text>
          <View className="w-10" />
        </View>

        <View className="px-5">
          <Text className="text-[22px] font-bold text-foreground">
            Operations overview
          </Text>
          <Text className="mt-1 text-[13px] text-muted">
            Monitor events, devices, and reconciliation.
          </Text>

          <View className="mt-6 gap-3">
            <AdminTile icon="calendar-outline" title="Events" subtitle="Status, members, settlement" />
            <AdminTile icon="hardware-chip-outline" title="Devices" subtitle="Pending approvals, alerts" />
            <AdminTile icon="people-outline" title="Vendors" subtitle="Onboarding and members" />
            <AdminTile icon="alert-circle-outline" title="Alerts" subtitle="Chain breaks, anomalies" />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function AdminTile({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="rounded-2xl bg-surface px-5 py-4 flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name={icon} size={20} color="#0a0a0a" />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-foreground">{title}</Text>
        <Text className="mt-0.5 text-[12px] text-muted">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </View>
  );
}
