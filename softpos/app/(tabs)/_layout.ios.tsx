import { Redirect } from 'expo-router';
import {
  Icon,
  Label,
  NativeTabs,
} from 'expo-router/unstable-native-tabs';

import { useAuthContext } from '@/lib/auth-context';

export default function TabsLayout() {
  const { session, isLoading } = useAuthContext();

  if (isLoading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="festivals">
        <Icon sf={{ default: 'calendar', selected: 'calendar' }} />
        <Label>Festivals</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
