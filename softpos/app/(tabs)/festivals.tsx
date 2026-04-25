import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui';

export default function FestivalsScreen() {
  return (
    <Screen edgeBottom={false}>
      <View className="flex-row items-center justify-center px-5 pt-2 pb-4">
        <Text className="text-[18px] font-semibold text-foreground">
          Festivals
        </Text>
      </View>
      <View className="flex-1 items-center justify-center px-8 bg-background">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-secondary mb-4">
          <Ionicons name="calendar-outline" size={26} color="#0a0a0a" />
        </View>
        <Text className="text-[17px] font-semibold text-foreground">
          No festivals yet
        </Text>
        <Text className="mt-2 text-center text-[13px] text-muted">
          The festivals you join will show up here, with passes and balance per
          event.
        </Text>
      </View>
    </Screen>
  );
}
