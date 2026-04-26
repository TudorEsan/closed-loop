import { Redirect, Stack } from 'expo-router';

import { useAuthContext } from '@/lib/auth-context';

export default function TabsLayout() {
  const { session, isLoading } = useAuthContext();

  if (isLoading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
