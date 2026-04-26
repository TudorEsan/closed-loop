import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useScope } from '@/hooks/use-scope';
import { ScopePicker } from './scope-picker';

// Compact pill shown in the BlurHeader right slot. Tapping opens the
// scope picker. Hidden when the user only has the attendee scope (no
// memberships at all), since there is nothing to pick.
export function ScopeChip() {
  const [open, setOpen] = useState(false);
  const { memberships } = useScope();
  const total =
    (memberships?.events.length ?? 0) + (memberships?.vendors.length ?? 0);

  if (!memberships || total === 0) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        className="h-9 px-3 flex-row items-center gap-1 rounded-full bg-surface"
      >
        <Ionicons name="swap-horizontal" size={16} color="#0a0a0a" />
        <Text className="text-xs font-semibold text-foreground">Switch</Text>
      </Pressable>
      <ScopePicker visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function ProfileButton() {
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      hitSlop={8}
      className="h-9 w-9 items-center justify-center rounded-full bg-surface"
    >
      <Ionicons name="person-outline" size={18} color="#0a0a0a" />
    </Pressable>
  );
}

// Static badge that shows the active role for staff/vendor headers.
// Use inside the hero card or anywhere a passive label fits.
export function ScopeBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'accent';
}) {
  const cls =
    tone === 'success'
      ? 'bg-success/15'
      : tone === 'accent'
        ? 'bg-foreground/10'
        : 'bg-surface-secondary';
  const textCls =
    tone === 'success' ? 'text-success' : 'text-foreground';
  return (
    <View className={`self-start rounded-full px-3 py-1 ${cls}`}>
      <Text className={`text-xs font-semibold ${textCls}`}>{label}</Text>
    </View>
  );
}
