import { ActivityIndicator, View } from 'react-native';

import { useScope } from '@/hooks/use-scope';
import { AttendeeHome } from '@/components/home/attendee-home';
import { StaffHome } from '@/components/home/staff-home';
import { VendorHome } from '@/components/home/vendor-home';
import { theme } from '@/lib/theme';

export default function HomeScreen() {
  const { scope, isLoading } = useScope();

  if (isLoading || !scope) {
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

  if (scope.kind === 'event') {
    return <StaffHome event={scope.event} />;
  }
  if (scope.kind === 'vendor') {
    return <VendorHome vendor={scope.vendor} />;
  }
  return <AttendeeHome />;
}
