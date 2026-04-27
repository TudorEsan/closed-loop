import { Text, View } from "react-native";

import { type ChipState } from "@/lib/chip";
import { formatAmount } from "./format";

export function ChipDebug({
  label,
  state,
}: {
  label: string;
  state: ChipState;
}) {
  return (
    <View className="mt-6 w-full rounded-2xl bg-surface p-4">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </Text>
      <View className="mt-2 gap-1">
        <ChipDebugRow
          label="Balance"
          value={`${formatAmount(state.balance / 100)} RON`}
        />
        <ChipDebugRow
          label="Debit counter"
          value={String(state.debitCounter)}
        />
        <ChipDebugRow
          label="Credit counter seen"
          value={String(state.creditCounterSeen)}
        />
      </View>
    </View>
  );
}

function ChipDebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs font-medium text-foreground">{value}</Text>
    </View>
  );
}
