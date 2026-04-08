import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import { Avatar, Screen, SurfaceCard } from '@/components/ui';
import { theme } from '@/lib/theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

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

  return (
    <Screen edgeTop={false}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <SurfaceCard>
          <View
            style={{
              alignItems: 'center',
              gap: 12,
              paddingVertical: 8,
            }}
          >
            <Avatar
              fallback={user?.name || user?.email || '?'}
              size={88}
            />
            <Text
              style={{
                ...theme.font.title,
                color: theme.colors.foreground,
              }}
            >
              {user?.name || 'No name'}
            </Text>
            <Text
              style={{
                ...theme.font.bodySmall,
                color: theme.colors.mutedForeground,
              }}
            >
              {user?.email}
            </Text>
          </View>
        </SurfaceCard>

        <SurfaceCard noPadding>
          <Row label="Role" value={user?.role || 'attendee'} />
          <Separator />
          <Row label="Phone" value={user?.phone || 'Not set'} />
        </SurfaceCard>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.pill,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.9 : 1,
            ...theme.shadow.soft,
          })}
        >
          <Text
            style={{
              ...theme.font.button,
              color: theme.colors.danger,
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
      }}
    >
      <Text
        style={{
          ...theme.font.body,
          color: theme.colors.mutedForeground,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...theme.font.body,
          color: theme.colors.foreground,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Separator() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: theme.colors.border,
        marginHorizontal: theme.spacing.lg,
      }}
    />
  );
}
