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

export function getStoredScopeId(): string | null {
  if (cachedScopeId !== undefined) return cachedScopeId;
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
// memberships and we need to ask them to pick one.
export function pickDefaultScope(m: Memberships): Scope | null {
  const total = m.events.length + m.vendors.length;
  if (total === 0) return { kind: 'attendee' };
  if (total === 1) {
    if (m.events.length === 1) {
      return { kind: 'event', event: m.events[0] };
    }
    return { kind: 'vendor', vendor: m.vendors[0] };
  }
  return null;
}

export function eventScope(event: EventMembership): Scope {
  return { kind: 'event', event };
}

export function vendorScope(vendor: VendorMembership): Scope {
  return { kind: 'vendor', vendor };
}

export const ATTENDEE_SCOPE: Scope = { kind: 'attendee' };
