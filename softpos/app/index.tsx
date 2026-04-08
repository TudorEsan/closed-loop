import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Spinner } from 'heroui-native';

import { useAuth } from '@/lib/auth-context';

// Decides where to send the user based on session + role.
export default function Index() {
  const { session, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  // Vendor / staff accounts go to the vendor flow. Anyone else (attendee,
  // organizer, admin testing it) goes to the attendee flow by default.
  const role = user?.role ?? 'attendee';
  if (role === 'vendor' || role === 'operator') {
    return <Redirect href="/(vendor)" />;
  }
  return <Redirect href="/(attendee)" />;
}
