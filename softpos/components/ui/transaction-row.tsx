import { Text, View } from 'react-native';

import { Avatar } from './avatar';

type TransactionRowProps = {
  title: string;
  time: string;
  amount: string;
  avatarUri?: string;
  avatarFallback?: string;
};

// One row in the transactions list. Left: festival pfp + vendor name + time.
// Right: amount spent.
export function TransactionRow({
  title,
  time,
  amount,
  avatarUri,
  avatarFallback,
}: TransactionRowProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-row-bg px-3 py-2.5">
      <Avatar source={avatarUri} fallback={avatarFallback ?? title} size={38} />
      <View className="flex-1">
        <Text className="text-[15px] font-medium text-app-fg" numberOfLines={1}>
          {title}
        </Text>
        <Text className="mt-0.5 text-xs text-app-muted" numberOfLines={1}>
          {time}
        </Text>
      </View>
      <Text className="text-[15px] font-medium text-app-fg">{amount}</Text>
    </View>
  );
}
