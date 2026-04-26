import { Alert, ImageBackground, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BLUR_HEADER_HEIGHT,
  BlurHeader,
  Screen,
} from '@/components/ui';
import { ProfileButton, ScopeChip } from '@/components/scope/scope-chip';
import type { EventMembership } from '@/types/api';

const HERO_IMAGE = require('@/assets/background.png');

export function StaffHome({ event }: { event: EventMembership }) {
  const isAdmin = event.role === 'admin' || event.isOrganizer;
  const roleLabel = event.isOrganizer
    ? 'Organizer'
    : isAdmin
      ? 'Admin'
      : 'Operator';

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <Screen edgeTop={false} edgeBottom={false}>
      <Animated.ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        scrollIndicatorInsets={{ top: BLUR_HEADER_HEIGHT }}
      >
        <View style={{ height: insets.top + BLUR_HEADER_HEIGHT + 8 }} />

        <View className="px-5">
          <ImageBackground
            source={HERO_IMAGE}
            resizeMode="cover"
            imageStyle={{ borderRadius: 24 }}
            className="overflow-hidden rounded-3xl border border-white"
          >
            <View className="absolute inset-0 bg-black/40" />
            <View className="px-6 py-7 gap-4">
              <View className="self-start rounded-full bg-white/20 px-3 py-1">
                <Text className="text-xs font-semibold text-white">
                  {roleLabel}
                </Text>
              </View>
              <View>
                <Text
                  className="text-3xl font-bold tracking-tight text-white"
                  numberOfLines={1}
                >
                  {event.name}
                </Text>
                <Text className="mt-1 text-sm text-white/80">
                  {formatDateRange(event.startDate, event.endDate)}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
              </View>
              <StatusBadge status={event.status} />
            </View>
          </ImageBackground>

          <View className="mt-8">
            <Text className="text-xl font-semibold text-foreground">
              What do you want to do?
            </Text>
            <Text className="mt-1 text-sm text-muted">
              {isAdmin
                ? 'Manage the festival and onboard attendees.'
                : 'Help attendees link bracelets and top up.'}
            </Text>
          </View>

          <View className="mt-5 gap-3">
            <PrimaryAction
              icon="link"
              title="Link bracelet"
              subtitle="Scan ticket QR, tap their wristband"
              onPress={() => router.push('/link-bracelet')}
            />
            <SecondaryAction
              icon="cash-outline"
              title="Cash top-up"
              subtitle="Accept cash, credit a bracelet"
              onPress={() =>
                Alert.alert(
                  'Coming soon',
                  'Cash top-up at the gate is being wired up. For now, attendees can top up online.',
                )
              }
            />
            {isAdmin ? (
              <>
                <SecondaryAction
                  icon="people-outline"
                  title="Members"
                  subtitle="Operators and admins for this festival"
                  onPress={() =>
                    Alert.alert(
                      'Available in admin portal',
                      'Manage members from the web admin portal.',
                    )
                  }
                />
                <SecondaryAction
                  icon="storefront-outline"
                  title="Vendors"
                  subtitle="Onboard and approve vendor stands"
                  onPress={() =>
                    Alert.alert(
                      'Available in admin portal',
                      'Manage vendors from the web admin portal.',
                    )
                  }
                />
              </>
            ) : null}
          </View>

          <View className="mt-8">
            <Text className="text-xl font-semibold text-foreground">
              Today
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Your links and top-ups for today.
            </Text>
            <EmptyTodayCard />
          </View>
        </View>
      </Animated.ScrollView>

      <BlurHeader
        scrollY={scrollY}
        title={event.name}
        left={<ProfileButton />}
        right={<ScopeChip />}
      />
    </Screen>
  );
}

function PrimaryAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl bg-accent px-6 py-5 flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-3 flex-1">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <Ionicons name={icon} size={20} color="#0a0a0a" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-accent-foreground">
            {title}
          </Text>
          <Text
            className="mt-0.5 text-xs text-accent-foreground/70"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#0a0a0a" />
    </Pressable>
  );
}

function SecondaryAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl bg-surface px-6 py-5 flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-3 flex-1">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <Ionicons name={icon} size={20} color="#0a0a0a" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {title}
          </Text>
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </Pressable>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active';
  const isClosed = status === 'closed';
  const label = isActive
    ? 'Live now'
    : isClosed
      ? 'Closed'
      : capitalize(status);
  const dotCls = isActive ? 'bg-success' : 'bg-white/70';
  return (
    <View className="self-start flex-row items-center gap-2 rounded-full bg-white/20 px-3 py-1">
      <View className={`h-2 w-2 rounded-full ${dotCls}`} />
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </View>
  );
}

function EmptyTodayCard() {
  return (
    <View className="mt-3 items-center rounded-2xl bg-surface px-6 py-10">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name="time-outline" size={22} color="#0a0a0a" />
      </View>
      <Text className="text-base font-semibold text-foreground">
        Nothing yet
      </Text>
      <Text className="mt-1 text-center text-sm text-muted">
        Bracelets you link and top-ups you process today will show up here.
      </Text>
    </View>
  );
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString('en-GB', { day: 'numeric' })} to ${end.toLocaleDateString('en-GB', opts)}`;
  }
  return `${start.toLocaleDateString('en-GB', opts)} to ${end.toLocaleDateString('en-GB', opts)}`;
}
