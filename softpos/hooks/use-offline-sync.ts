import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

import {
  groupByWristband,
  markApplied,
  type PendingDebit,
} from '@/lib/queue/offline-queue';
import { reconciliationApi } from '@/lib/api/reconciliation';

export type SyncOutcome = {
  eventId: string;
  wristbandUid: string;
  applied: string[];
  rejected: { idempotencyKey: string; reason: string }[];
  chipShouldWrite: { balance: number; credit_counter: number };
} | {
  eventId: string;
  wristbandUid: string;
  error: string;
};

async function syncGroup(args: {
  eventId: string;
  wristbandUid: string;
  debits: PendingDebit[];
}): Promise<SyncOutcome> {
  // Best-effort snapshot using the highest counter we queued. The server
  // treats this as a hint, the chip is the source of truth on the next
  // tap.
  const lastDebit = args.debits[args.debits.length - 1];
  const chipState = {
    balance: 0,
    debit_counter: lastDebit?.counterValue ?? 0,
    credit_counter_seen: 0,
  };
  try {
    const res = await reconciliationApi.sync(args.eventId, args.wristbandUid, {
      chipState,
      pendingDebits: args.debits.map((d) => ({
        idempotencyKey: d.idempotencyKey,
        amount: d.amount,
        vendorId: d.vendorId,
        counterValue: d.counterValue,
        deviceId: d.deviceId,
        clientTimestamp: d.clientTimestamp,
      })),
    });
    const drainKeys = [
      ...res.applied,
      ...res.rejected
        .filter((r) => r.reason === 'duplicate' || r.reason === 'invalid')
        .map((r) => r.idempotencyKey),
    ];
    if (drainKeys.length > 0) await markApplied(drainKeys);
    return {
      eventId: args.eventId,
      wristbandUid: args.wristbandUid,
      applied: res.applied,
      rejected: res.rejected,
      chipShouldWrite: res.chipShouldWrite,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    return {
      eventId: args.eventId,
      wristbandUid: args.wristbandUid,
      error: msg,
    };
  }
}

export async function drainQueue(): Promise<SyncOutcome[]> {
  const groups = await groupByWristband();
  const results: SyncOutcome[] = [];
  for (const group of groups) {
    results.push(await syncGroup(group));
  }
  return results;
}

export function useOfflineSync(onResult?: (results: SyncOutcome[]) => void) {
  const inFlightRef = useRef(false);
  const handlerRef = useRef(onResult);
  handlerRef.current = onResult;

  const trigger = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const results = await drainQueue();
      if (results.length > 0) handlerRef.current?.(results);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void trigger();
    });
    const offSub = onlineManager.subscribe((isOnline) => {
      if (isOnline) void trigger();
    });
    void trigger();
    return () => {
      sub.remove();
      offSub();
    };
  }, [trigger]);

  return { trigger };
}
