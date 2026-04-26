import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  ATTENDEE_SCOPE,
  getStoredScopeId,
  pickDefaultScope,
  scopeFromId,
  scopeId as scopeIdOf,
  setStoredScopeId,
} from '@/lib/scope';
import type { Memberships, Scope } from '@/types/api';
import { useMyMemberships } from './use-memberships';

type Listener = () => void;

let activeScopeId: string | null = getStoredScopeId();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot(): string | null {
  return activeScopeId;
}

async function writeScopeId(next: string | null) {
  activeScopeId = next;
  await setStoredScopeId(next);
  emit();
}

export type UseScopeValue = {
  scope: Scope | null;
  setScope: (scope: Scope) => Promise<void>;
  clearScope: () => Promise<void>;
  memberships: Memberships | null;
  isLoading: boolean;
  needsPicker: boolean;
};

export function useScope(): UseScopeValue {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const membershipsQuery = useMyMemberships();
  const memberships = membershipsQuery.data ?? null;

  // If the stored id no longer matches a real membership, fall back to
  // the unambiguous default (or null when ambiguous).
  let scope: Scope | null = null;
  if (memberships) {
    if (stored) {
      scope = scopeFromId(stored, memberships);
    }
    if (!scope) {
      scope = pickDefaultScope(memberships);
    }
  }

  // Self-heal: if the stored id is invalid, clear it once memberships
  // load so future restarts don't keep pointing at a missing scope.
  useEffect(() => {
    if (!memberships || !stored) return;
    const matched = scopeFromId(stored, memberships);
    if (!matched) {
      void writeScopeId(null);
    }
  }, [memberships, stored]);

  const setScope = useCallback(async (next: Scope) => {
    await writeScopeId(scopeIdOf(next));
  }, []);

  const clearScope = useCallback(async () => {
    await writeScopeId(null);
  }, []);

  const needsPicker = !!memberships && !scope;

  return {
    scope: scope ?? (memberships ? ATTENDEE_SCOPE : null),
    setScope,
    clearScope,
    memberships,
    isLoading: membershipsQuery.isLoading,
    needsPicker,
  };
}
