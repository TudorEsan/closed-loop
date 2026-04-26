import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ATTENDEE_SCOPE, scopeId } from '@/lib/scope';
import type {
  EventMembership,
  Memberships,
  Scope,
  VendorMembership,
} from '@/types/api';

type Props = {
  memberships: Memberships;
  activeScope: Scope | null;
  onPick: (scope: Scope) => void;
  showAttendee?: boolean;
};

export function ScopeList({
  memberships,
  activeScope,
  onPick,
  showAttendee = true,
}: Props) {
  const activeId = activeScope ? scopeId(activeScope) : null;

  return (
    <View className="gap-3">
      {memberships.events.map((event) => (
        <EventScopeRow
          key={event.eventId}
          event={event}
          isActive={activeId === scopeId({ kind: 'event', event })}
          onPress={() => onPick({ kind: 'event', event })}
        />
      ))}
      {memberships.vendors.map((vendor) => (
        <VendorScopeRow
          key={vendor.vendorId}
          vendor={vendor}
          isActive={activeId === scopeId({ kind: 'vendor', vendor })}
          onPress={() => onPick({ kind: 'vendor', vendor })}
        />
      ))}
      {showAttendee ? (
        <AttendeeScopeRow
          isActive={activeId === scopeId(ATTENDEE_SCOPE)}
          onPress={() => onPick(ATTENDEE_SCOPE)}
        />
      ) : null}
    </View>
  );
}

function EventScopeRow({
  event,
  isActive,
  onPress,
}: {
  event: EventMembership;
  isActive: boolean;
  onPress: () => void;
}) {
  const roleLabel = event.isOrganizer
    ? 'Organizer'
    : event.role === 'admin'
      ? 'Admin'
      : 'Operator';
  return (
    <Row
      icon="calendar"
      iconBg="#0a0a0a"
      iconFg="#ffffff"
      title={event.name}
      subtitle={`${roleLabel} at this festival`}
      isActive={isActive}
      onPress={onPress}
    />
  );
}

function VendorScopeRow({
  vendor,
  isActive,
  onPress,
}: {
  vendor: VendorMembership;
  isActive: boolean;
  onPress: () => void;
}) {
  const roleLabel =
    vendor.role === 'owner'
      ? 'Owner'
      : vendor.role === 'manager'
        ? 'Manager'
        : 'Cashier';
  return (
    <Row
      icon="storefront"
      iconBg="#7c3aed"
      iconFg="#ffffff"
      title={vendor.businessName}
      subtitle={`${roleLabel} at ${vendor.eventName}`}
      isActive={isActive}
      onPress={onPress}
    />
  );
}

function AttendeeScopeRow({
  isActive,
  onPress,
}: {
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Row
      icon="wallet"
      iconBg="#16a34a"
      iconFg="#ffffff"
      title="My wallet"
      subtitle="Pay at vendors with your bracelet"
      isActive={isActive}
      onPress={onPress}
    />
  );
}

function Row({
  icon,
  iconBg,
  iconFg,
  title,
  subtitle,
  isActive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconFg: string;
  title: string;
  subtitle: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl bg-surface px-5 py-4 flex-row items-center gap-3"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={18} color={iconFg} />
      </View>
      <View className="flex-1">
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {isActive ? (
        <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      )}
    </Pressable>
  );
}
