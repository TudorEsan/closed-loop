import { ScrollView, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Spinner } from 'heroui-native';

import { Screen } from '@/components/ui';
import { ScopeList } from '@/components/scope/scope-list';
import { useScope } from '@/hooks/use-scope';
import type { Scope } from '@/types/api';

export default function SelectScopeScreen() {
  const { memberships, scope, setScope, isLoading } = useScope();

  async function handlePick(next: Scope) {
    await setScope(next);
    router.replace('/home');
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-5 pt-4 pb-4">
        <Text className="text-2xl font-bold text-foreground">
          Where are you working today?
        </Text>
        <Text className="mt-2 text-sm text-muted">
          Pick a festival or vendor stand to continue. You can switch any time
          from the home screen.
        </Text>
      </View>

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {isLoading || !memberships ? (
          <View className="items-center py-12">
            <Spinner color="#0a0a0a" />
          </View>
        ) : (
          <ScopeList
            memberships={memberships}
            activeScope={scope}
            onPick={handlePick}
          />
        )}
      </ScrollView>
    </Screen>
  );
}
