import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuthContext } from '@/lib/auth-context';
import { useScope } from '@/hooks/use-scope';
import { theme } from '@/lib/theme';

// Decides where to send the user based on the session and active scope.
export default function Index() {
  const { session, isLoading: authLoading } = useAuthContext();
  const { needsPicker, isLoading: scopeLoading, memberships } = useScope();

  if (authLoading || (session && scopeLoading)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.foreground} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (memberships && needsPicker) {
    return <Redirect href="/select-scope" />;
  }

  return <Redirect href="/home" />;
}
