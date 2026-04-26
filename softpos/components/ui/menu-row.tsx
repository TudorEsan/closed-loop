import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type MenuRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  badge?: string;
};

export function MenuRow({
  icon,
  label,
  subtitle,
  onPress,
  showChevron = true,
  badge,
}: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000010" }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <View className="flex-row items-center px-4 py-4">
        <View className="h-9 w-9 items-center justify-center">
          <Ionicons name={icon} size={22} color="#0a0a0a" />
        </View>
        <View className="ml-2 flex-1">
          <Text className="text-base font-medium text-foreground">{label}</Text>
          {subtitle ? (
            <Text
              className="mt-0.5 text-xs font-normal text-muted"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <View className="mr-2 rounded-full bg-foreground px-2 py-0.5">
            <Text className="text-xs font-semibold text-background">
              {badge}
            </Text>
          </View>
        ) : null}
        {showChevron ? (
          <Ionicons name="chevron-forward" size={18} color="#b5b5b5" />
        ) : null}
      </View>
    </Pressable>
  );
}

export function MenuDivider() {
  return <View className="ml-14 h-px bg-separator" />;
}
