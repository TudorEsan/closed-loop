import { Text, View } from 'react-native';
import { BlurView } from 'expo-blur';

type BalanceCardProps = {
  label?: string;
  amount: string;
  children?: React.ReactNode;
};

// Frosted glass card that sits on the hero background. BlurView handles the
// actual blur, we stack a thin white border on top for the smooth glassy feel.
export function BalanceCard({
  label = 'Total Balance',
  amount,
  children,
}: BalanceCardProps) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-glass-border"
    >
      <BlurView
        intensity={40}
        tint="dark"
        style={{ paddingTop: 24, paddingBottom: 18, paddingHorizontal: 18 }}
      >
        <View className={`items-center ${children ? 'mb-5' : ''}`}>
          <Text className="mb-2 text-sm font-medium text-white/90">
            {label}
          </Text>
          <Text className="text-[30px] font-bold tracking-tight text-white">
            {amount}
          </Text>
        </View>
        {children}
      </BlurView>
    </View>
  );
}
