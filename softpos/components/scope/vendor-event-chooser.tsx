import { useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useScope } from "@/hooks/use-scope";
import type { VendorMembership } from "@/types/api";

type VendorEventOption = {
  eventId: string;
  eventName: string;
  vendors: VendorMembership[];
};

export function VendorEventChooser({
  vendor,
  fallback,
}: {
  vendor: VendorMembership;
  fallback?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { memberships, setScope } = useScope();
  const foreground = useThemeColor("foreground");
  const muted = useThemeColor("muted");
  const insets = useSafeAreaInsets();

  const options = useMemo(() => {
    const byEvent = new Map<string, VendorEventOption>();
    for (const item of memberships?.vendors ?? []) {
      const current = byEvent.get(item.eventId);
      if (current) {
        current.vendors.push(item);
      } else {
        byEvent.set(item.eventId, {
          eventId: item.eventId,
          eventName: item.eventName,
          vendors: [item],
        });
      }
    }
    return Array.from(byEvent.values());
  }, [memberships?.vendors]);

  if (options.length < 2) return fallback ?? null;

  async function pickEvent(option: VendorEventOption) {
    const nextVendor =
      option.vendors.find((item) => item.vendorId === vendor.vendorId) ??
      option.vendors[0];

    await setScope({ kind: "vendor", vendor: nextVendor });
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        className="h-9 max-w-44 flex-row items-center gap-1 rounded-full bg-surface px-3"
      >
        <Ionicons name="calendar-outline" size={16} color={foreground} />
        <Text
          className="flex-1 text-xs font-semibold text-foreground"
          numberOfLines={1}
        >
          {vendor.eventName}
        </Text>
        <Ionicons name="chevron-down" size={14} color={muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-end bg-backdrop">
          <Pressable className="flex-1" onPress={() => setOpen(false)} />
          <View
            className="rounded-t-3xl bg-overlay px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <View className="items-center pb-3">
              <View className="h-1 w-10 rounded-full bg-surface-tertiary" />
            </View>

            <View className="flex-row items-center justify-between pb-4">
              <View className="flex-1 pr-3">
                <Text className="text-xl font-bold text-overlay-foreground">
                  Choose event
                </Text>
                <Text className="mt-1 text-sm text-muted">
                  Select where this vendor terminal is working now.
                </Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary"
              >
                <Ionicons name="close" size={18} color={foreground} />
              </Pressable>
            </View>

            <ScrollView
              className="max-h-96"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {options.map((option) => (
                <EventOptionRow
                  key={option.eventId}
                  option={option}
                  active={option.eventId === vendor.eventId}
                  onPress={() => pickEvent(option)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function EventOptionRow({
  option,
  active,
  onPress,
}: {
  option: VendorEventOption;
  active: boolean;
  onPress: () => void;
}) {
  const foreground = useThemeColor("foreground");
  const muted = useThemeColor("muted");
  const title = option.eventName;
  const subtitle = option.vendors.map((item) => item.businessName).join(", ");

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-4"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name="calendar-outline" size={20} color={foreground} />
      </View>
      <View className="flex-1">
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {active ? (
        <Ionicons name="checkmark-circle" size={22} color={foreground} />
      ) : (
        <Ionicons name="ellipse-outline" size={22} color={muted} />
      )}
    </Pressable>
  );
}
