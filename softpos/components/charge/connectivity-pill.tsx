import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function ConnectivityPill({
  online,
  forced,
  onToggle,
}: {
  online: boolean;
  forced: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={6}
      className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${
        online ? "bg-surface" : "bg-warning/20"
      }`}
    >
      <Ionicons
        name={online ? "wifi" : "airplane"}
        size={12}
        color={online ? "#525252" : "#a16207"}
      />
      <Text
        className={`text-xs font-medium ${
          online ? "text-muted" : "text-warning"
        }`}
      >
        {online ? "Online" : forced ? "Offline (forced)" : "Offline"}
      </Text>
    </Pressable>
  );
}
