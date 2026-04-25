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
import { Avatar, Screen } from '@/components/ui';

export default function ProfileScreen() {
  const { user, signOut } = useAuthContext();

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

  function notImplemented(label: string) {
    Alert.alert(label, 'Coming soon.');
  }

  const displayName = user?.name || user?.email?.split('@')[0] || 'You';
  const handle = user?.email ? `@${user.email.split('@')[0]}` : '';

  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center justify-center px-5 pt-2 pb-4">
          <Text className="text-[18px] font-semibold text-foreground">
            Profile
          </Text>
        </View>

        <View className="items-center px-5 pb-8 pt-2">
          <Avatar fallback={displayName} size={96} borderColor="#e5e5e5" />
          <Text className="mt-4 text-[28px] font-bold tracking-tight text-foreground">
            {displayName}
          </Text>
          {handle ? (
            <Text className="mt-1 text-[14px] font-medium text-muted">
              {handle}
            </Text>
          ) : null}
        </View>

        <View className="px-4">
          <View className="overflow-hidden rounded-2xl bg-surface">
            <MenuRow
              icon="person-outline"
              label="Personal info"
              subtitle={user?.email ?? undefined}
              onPress={() => notImplemented('Personal info')}
            />
            <Divider />
            <MenuRow
              icon="wallet-outline"
              label="Wallet details"
              subtitle={user?.role ? capitalize(user.role) : undefined}
              onPress={() => notImplemented('Wallet details')}
            />
            <Divider />
            <MenuRow
              icon="shield-checkmark-outline"
              label="Security"
              onPress={() => notImplemented('Security')}
            />
            <Divider />
            <MenuRow
              icon="notifications-outline"
              label="Notifications"
              onPress={() => notImplemented('Notifications')}
            />
            <Divider />
            <MenuRow
              icon="help-circle-outline"
              label="Help"
              onPress={() => notImplemented('Help')}
            />
            <Divider />
            <MenuRow
              icon="settings-outline"
              label="Settings"
              onPress={() => notImplemented('Settings')}
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
            <Text className="text-[13px] font-normal text-muted">
              Delete account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  subtitle,
  onPress,
  showChevron = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#00000010' }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <View className="flex-row items-center px-4 py-4">
        <View className="h-9 w-9 items-center justify-center">
          <Ionicons name={icon} size={22} color="#0a0a0a" />
        </View>
        <View className="ml-2 flex-1">
          <Text className="text-[16px] font-medium text-foreground">
            {label}
          </Text>
          {subtitle ? (
            <Text
              className="mt-0.5 text-[12px] font-normal text-muted"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {showChevron ? (
          <Ionicons name="chevron-forward" size={18} color="#b5b5b5" />
        ) : null}
      </View>
    </Pressable>
  );
}

function Divider() {
  return <View className="ml-[60px] h-px bg-separator" />;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
