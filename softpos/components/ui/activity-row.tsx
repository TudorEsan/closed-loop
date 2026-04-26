import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ActivityRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconFg: string;
  title: string;
  subtitle?: string | null;
  amount: string;
  amountTone?: 'default' | 'success' | 'danger';
  time?: string;
};

export function ActivityRow({
  icon,
  iconBg,
  iconFg,
  title,
  subtitle,
  amount,
  amountTone = 'default',
  time,
}: ActivityRowProps) {
  const amountClass =
    amountTone === 'success'
      ? 'text-success'
      : amountTone === 'danger'
        ? 'text-danger'
        : 'text-foreground';

  return (
    <View className="flex-row items-center gap-3 py-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={18} color={iconFg} />
      </View>
      <View className="flex-1">
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text className={`text-base font-semibold ${amountClass}`}>
          {amount}
        </Text>
        {time ? (
          <Text className="mt-0.5 text-xs text-muted">{time}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function ActivityList<T>({
  items,
  keyOf,
  render,
}: {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <View>
      {items.map((item, idx) => (
        <View key={keyOf(item)}>
          {render(item)}
          {idx < items.length - 1 ? (
            <View className="h-px bg-separator ml-14" />
          ) : null}
        </View>
      ))}
    </View>
  );
}
