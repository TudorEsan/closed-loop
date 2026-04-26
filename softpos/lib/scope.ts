import * as SecureStore from 'expo-secure-store';

import type {
  EventMembership,
  Memberships,
  Scope,
  VendorMembership,
} from '@/types/api';

const SCOPE_KEY = 'softpos.active-scope';
const ATTENDEE_ID = 'attendee';

let cachedScopeId: string | null | undefined = undefined;

type ScopeListener = () => void;
const scopeListeners = new Set<ScopeListener>();

export function subscribeToStoredScopeId(listener: ScopeListener): () => void {
  scopeListeners.add(listener);
  return () => {
    scopeListeners.delete(listener);
  };
}

function emitScopeChange() {
  for (const l of scopeListeners) l();
}

export function getStoredScopeId(): string | null {
  if (cachedScopeId !== undefined) return cachedScopeId ?? null;
  const value = SecureStore.getItem(SCOPE_KEY);
  cachedScopeId = value;
  return value;
}

export async function setStoredScopeId(id: string | null): Promise<void> {
  cachedScopeId = id;
  if (id) {
    await SecureStore.setItemAsync(SCOPE_KEY, id);
  } else {
    await SecureStore.deleteItemAsync(SCOPE_KEY);
  }
  emitScopeChange();
}

export function scopeId(scope: Scope): string {
  if (scope.kind === 'attendee') return ATTENDEE_ID;
  if (scope.kind === 'event') return `event:${scope.event.eventId}`;
  return `vendor:${scope.vendor.vendorId}`;
}

export function scopeFromId(id: string, m: Memberships): Scope | null {
  if (id === ATTENDEE_ID) return { kind: 'attendee' };
  if (id.startsWith('event:')) {
    const eventId = id.slice('event:'.length);
    const event = m.events.find((e) => e.eventId === eventId);
    return event ? { kind: 'event', event } : null;
  }
  if (id.startsWith('vendor:')) {
    const vendorId = id.slice('vendor:'.length);
    const vendor = m.vendors.find((v) => v.vendorId === vendorId);
    return vendor ? { kind: 'vendor', vendor } : null;
  }
  return null;
}

// Returns the unambiguous default scope, or null when the user has 2+
// memberships of the same kind and we need to ask them to pick one.
// Events take priority over vendors, so an event admin who was also added
// as a vendor member still lands on the staff view by default.
export function pickDefaultScope(m: Memberships): Scope | null {
  if (m.events.length === 1) return { kind: 'event', event: m.events[0] };
  if (m.events.length > 1) return null;
  if (m.vendors.length === 1) return { kind: 'vendor', vendor: m.vendors[0] };
  if (m.vendors.length > 1) return null;
  return { kind: 'attendee' };
}

export function eventScope(event: EventMembership): Scope {
  return { kind: 'event', event };
}

export function vendorScope(vendor: VendorMembership): Scope {
  return { kind: 'vendor', vendor };
}

export const ATTENDEE_SCOPE: Scope = { kind: 'attendee' };
