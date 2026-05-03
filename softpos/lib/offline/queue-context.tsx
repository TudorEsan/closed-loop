import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { useScope } from "@/hooks/use-scope";
import type { SyncResponse } from "@/types/sync";

import { getOnline, subscribeOnline } from "./network";
import {
  appendDebit as storeAppendDebit,
  clear as storeClear,
  listDebits,
  removeRejected as storeRemoveRejected,
} from "./queue-store";
import {
  runAutoSyncForBracelet,
  runSyncForBracelet,
  uniquePendingBracelets,
} from "./sync-engine";
import type { LocalDebit, QueueScope, SyncOutcome } from "./types";

export type QueueContextValue = {
  scope: QueueScope | null;
  isOnline: boolean;
  netOnline: boolean;
  forceOffline: boolean;
  setForceOffline(v: boolean): void;
  debits: LocalDebit[];
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncResponse: SyncResponse | null;
  lastSyncError: string | null;
  appendDebit(debit: LocalDebit): Promise<void>;
  refresh(): Promise<void>;
  syncBracelet(wristbandUid: string): Promise<SyncOutcome>;
  autoSyncAll(): Promise<void>;
  clearAll(): Promise<void>;
  removeRejected(): Promise<void>;
};

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: ReactNode }) {
  const { scope: appScope } = useScope();
  const queueScope = useMemo<QueueScope | null>(() => {
    if (appScope?.kind !== "vendor") return null;
    return {
      eventId: appScope.vendor.eventId,
      vendorId: appScope.vendor.vendorId,
    };
  }, [appScope]);

  const [debits, setDebits] = useState<LocalDebit[]>([]);
  const [netOnline, setNetOnline] = useState(true);
  const [forceOffline, setForceOffline] = useState(false);
  const isOnline = netOnline && !forceOffline;
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncResponse, setLastSyncResponse] =
    useState<SyncResponse | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const syncInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!queueScope) {
      setDebits([]);
      return;
    }
    setDebits(await listDebits(queueScope));
  }, [queueScope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    void getOnline().then((v) => {
      if (mounted) setNetOnline(v);
    });
    const unsubNet = subscribeOnline(setNetOnline);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => {
      mounted = false;
      unsubNet();
      sub.remove();
    };
  }, [refresh]);

  const appendDebit = useCallback(
    async (debit: LocalDebit) => {
      if (!queueScope) throw new Error("No vendor scope active");
      await storeAppendDebit(queueScope, debit);
      await refresh();
    },
    [queueScope, refresh],
  );

  const syncBracelet = useCallback(
    async (wristbandUid: string): Promise<SyncOutcome> => {
      if (!queueScope) {
        return { ok: false, error: "No vendor scope active" };
      }
      if (syncInFlight.current) {
        return { ok: false, error: "A sync is already in progress" };
      }
      syncInFlight.current = true;
      setIsSyncing(true);
      setLastSyncError(null);
      try {
        const outcome = await runSyncForBracelet(queueScope, wristbandUid);
        setLastSyncAt(new Date().toISOString());
        if (outcome.ok) {
          setLastSyncResponse(outcome.response);
        } else {
          setLastSyncError(outcome.error);
        }
        await refresh();
        return outcome;
      } finally {
        syncInFlight.current = false;
        setIsSyncing(false);
      }
    },
    [queueScope, refresh],
  );

  const autoSyncAll = useCallback(async () => {
    if (!queueScope) return;
    if (syncInFlight.current) return;
    const uids = await uniquePendingBracelets(queueScope);
    if (uids.length === 0) return;
    syncInFlight.current = true;
    setIsSyncing(true);
    setLastSyncError(null);
    try {
      let lastError: string | null = null;
      let lastResponse: SyncResponse | null = null;
      for (const uid of uids) {
        const outcome = await runAutoSyncForBracelet(queueScope, uid);
        if (outcome.ok) {
          lastResponse = outcome.response;
        } else if ("error" in outcome) {
          lastError = outcome.error;
        }
      }
      setLastSyncAt(new Date().toISOString());
      if (lastResponse) setLastSyncResponse(lastResponse);
      if (lastError) setLastSyncError(lastError);
      await refresh();
    } finally {
      syncInFlight.current = false;
      setIsSyncing(false);
    }
  }, [queueScope, refresh]);

  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (!wasOnline && isOnline) {
      void autoSyncAll();
    }
  }, [isOnline, autoSyncAll]);

  const clearAll = useCallback(async () => {
    if (!queueScope) return;
    await storeClear(queueScope);
    await refresh();
  }, [queueScope, refresh]);

  const removeRejected = useCallback(async () => {
    if (!queueScope) return;
    await storeRemoveRejected(queueScope);
    await refresh();
  }, [queueScope, refresh]);

  const pendingCount = useMemo(
    () => debits.filter((d) => d.status === "pending").length,
    [debits],
  );

  const value: QueueContextValue = {
    scope: queueScope,
    isOnline,
    netOnline,
    forceOffline,
    setForceOffline,
    debits,
    pendingCount,
    isSyncing,
    lastSyncAt,
    lastSyncResponse,
    lastSyncError,
    appendDebit,
    refresh,
    syncBracelet,
    autoSyncAll,
    clearAll,
    removeRejected,
  };

  return (
    <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
  );
}

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error("useQueue must be used inside QueueProvider");
  return ctx;
}
