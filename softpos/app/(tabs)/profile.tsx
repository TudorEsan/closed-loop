import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthContext } from '@/lib/auth-context';
import { Avatar, MenuRow, Screen } from '@/components/ui';
import { useQueue } from '@/lib/offline';

export default function ProfileScreen() {
  const { user, signOut } = useAuthContext();
  const queue = useQueue();
  const pendingBadge =
    queue.pendingCount > 0 ? String(queue.pendingCount) : undefined;

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } finally {
            router.replace('/login');
          }
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently remove your account and wallet. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Not available', 'Please contact support to delete your account.');
          },
        },
      ],
    );
  }

  const displayName = user?.name || user?.email?.split('@')[0] || 'You';
  const handle = user?.email ? `@${user.email.split('@')[0]}` : '';

  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
          >
            <Ionicons name="chevron-back" size={20} color="#0a0a0a" />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">
            Profile
          </Text>
          <View className="h-9 w-9" />
        </View>

        <View className="items-center px-5 pb-8 pt-2">
          <Avatar fallback={displayName} size={96} borderColor="#e5e5e5" />
          <Text className="mt-4 text-3xl font-bold tracking-tight text-foreground">
            {displayName}
          </Text>
          {handle ? (
            <Text className="mt-1 text-sm font-medium text-muted">
              {handle}
            </Text>
          ) : null}
        </View>

        <View className="px-4">
          <View className="overflow-hidden rounded-2xl bg-surface">
            <MenuRow
              icon="settings-outline"
              label="Settings"
              badge={pendingBadge}
              onPress={() => router.push('/settings')}
            />
          </View>

          <View className="mt-3 overflow-hidden rounded-2xl bg-surface">
            <MenuRow
              icon="log-out-outline"
              label="Log out"
              onPress={handleSignOut}
              showChevron={false}
            />
          </View>

          <Pressable
            onPress={handleDeleteAccount}
            hitSlop={8}
            className="items-center py-8"
          >
            <Text className="text-xs font-normal text-muted">
              Delete account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
