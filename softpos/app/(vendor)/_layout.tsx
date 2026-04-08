import { Stack, Redirect } from 'expo-router';
import { View } from 'react-native';
import { Spinner } from 'heroui-native';

import { useAuth } from '@/lib/auth-context';

export default function VendorLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="register-device" />
      <Stack.Screen name="charge" />
      <Stack.Screen name="transactions" />
    </Stack>
  );
}
