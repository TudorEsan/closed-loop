import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/ui";
import { useNfc } from "@/hooks/use-nfc";
import { useQueue } from "@/lib/offline";
import type { LocalDebit } from "@/lib/offline";
import type { ChipState } from "@/lib/chip";
import type { RejectReason, SyncResponse } from "@/types/sync";

export default function SyncDebugScreen() {
  const queue = useQueue();
  const nfc = useNfc();
  const [actionError, setActionError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  const groupedByBracelet = useMemo(
    () => groupByWristband(queue.debits),
    [queue.debits],
  );

  const pendingCount = queue.pendingCount;
  const rejectedCount = queue.debits.filter(
    (d) => d.status === "rejected",
  ).length;

  async function handleSyncNow() {
    setActionError(null);
    setDiagnostic(null);
    if (!queue.scope) {
      setActionError("Pick a vendor scope first");
      return;
    }
    if (!queue.isOnline) {
      setActionError("Cannot sync while offline");
      return;
    }
    const read = await nfc.readBracelet();
    if (read.kind === "canceled") return;
    if (read.kind === "error") {
      setActionError(read.error);
      return;
    }
    if (read.kind === "blank") {
      setActionError(`Bracelet not initialized (${read.reason})`);
      return;
    }
    const writeChipBack = async (state: ChipState) => {
      const r = await nfc.writeChipState(read.uid, state);
      if (r.kind === "error") throw new Error(r.error);
      if (r.kind === "canceled") throw new Error("Chip write canceled");
    };
    const outcome = await queue.syncBracelet(read.uid, {
      chipState: read.chipState,
      writeChipBack,
    });
    if (!outcome.ok) setActionError(outcome.error);
  }

  async function handleReadChip() {
    setActionError(null);
    setDiagnostic(null);
    const read = await nfc.readBracelet();
    if (read.kind === "canceled") return;
    if (read.kind === "error") {
      setActionError(read.error);
      return;
    }
    if (read.kind === "blank") {
      setDiagnostic(`UID ${read.uid} - blank chip (${read.reason})`);
      return;
    }
    setDiagnostic(
      `UID ${read.uid}\n` +
        `Balance ${formatCents(read.chipState.balance)} RON\n` +
        `Debit counter ${read.chipState.debitCounter}\n` +
        `Credit counter seen ${read.chipState.creditCounterSeen}`,
    );
  }

  function handleClearAll() {
    Alert.alert(
      "Clear queue",
      `Drop all ${queue.debits.length} debit(s) without sending? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => void queue.clearAll(),
        },
      ],
    );
  }

  return (
    <Screen edgeBottom={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
          >
            <Ionicons name="chevron-back" size={20} color="#0a0a0a" />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">
            Sync and offline
          </Text>
          <View className="h-9 w-9" />
        </View>

        <View className="px-5">
          <StatusCard
            online={queue.isOnline}
            scopeLabel={
              queue.scope
                ? `${queue.scope.eventId.slice(0, 8)} - ${queue.scope.vendorId.slice(0, 8)}`
                : "No vendor scope"
            }
            lastSyncAt={queue.lastSyncAt}
            isSyncing={queue.isSyncing}
            pendingCount={pendingCount}
            rejectedCount={rejectedCount}
          />
        </View>

        <View className="px-5 mt-4 gap-3">
          <ActionButton
            label={queue.isSyncing ? "Syncing..." : "Sync now"}
            tone="primary"
            disabled={
              !queue.scope || !queue.isOnline || queue.isSyncing || nfc.isBusy
            }
            onPress={handleSyncNow}
          />
          <ActionButton
            label="Read chip"
            tone="surface"
            disabled={nfc.isBusy}
            onPress={handleReadChip}
          />
          <ActionButton
            label="Discard rejected"
            tone="surface"
            disabled={rejectedCount === 0}
            onPress={() => void queue.removeRejected()}
          />
          <ActionButton
            label="Clear all"
            tone="danger"
            disabled={queue.debits.length === 0}
            onPress={handleClearAll}
          />
        </View>

        {actionError ? (
          <Text className="px-5 mt-4 text-sm text-danger">{actionError}</Text>
        ) : null}
        {diagnostic ? (
          <View className="mx-5 mt-4 rounded-2xl bg-surface p-4">
            <Text className="text-xs font-semibold text-muted mb-2">
              Last chip read
            </Text>
            <Text className="text-sm text-foreground" selectable>
              {diagnostic}
            </Text>
          </View>
        ) : null}

        <SectionHeader label="Pending" />
        {pendingCount === 0 ? (
          <EmptyState text="Nothing waiting to sync." />
        ) : (
          Object.entries(groupedByBracelet).map(([uid, debits]) => {
            const pending = debits.filter((d) => d.status === "pending");
            if (pending.length === 0) return null;
            return (
              <BraceletGroup
                key={`pending-${uid}`}
                wristbandUid={uid}
                debits={pending}
              />
            );
          })
        )}

        <SectionHeader label="Rejected" />
        {rejectedCount === 0 ? (
          <EmptyState text="No rejections to review." />
        ) : (
          Object.entries(groupedByBracelet).map(([uid, debits]) => {
            const rejected = debits.filter((d) => d.status === "rejected");
            if (rejected.length === 0) return null;
            return (
              <BraceletGroup
                key={`rejected-${uid}`}
                wristbandUid={uid}
                debits={rejected}
              />
            );
          })
        )}

        {queue.lastSyncResponse ? (
          <View className="mx-5 mt-6 rounded-2xl bg-surface p-4">
            <Text className="text-xs font-semibold text-muted mb-2">
              Last sync response
            </Text>
            <SyncResponseSummary response={queue.lastSyncResponse} />
          </View>
        ) : null}
        {queue.lastSyncError ? (
          <Text className="px-5 mt-3 text-sm text-danger">
            Last error: {queue.lastSyncError}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StatusCard({
  online,
  scopeLabel,
  lastSyncAt,
  isSyncing,
  pendingCount,
  rejectedCount,
}: {
  online: boolean;
  scopeLabel: string;
  lastSyncAt: string | null;
  isSyncing: boolean;
  pendingCount: number;
  rejectedCount: number;
}) {
  return (
    <View className="rounded-2xl bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <View
          className={`rounded-full px-3 py-1 ${
            online ? "bg-success/20" : "bg-warning/20"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              online ? "text-success" : "text-warning"
            }`}
          >
            {online ? "Online" : "Offline"}
          </Text>
        </View>
        {isSyncing ? (
          <Text className="text-xs font-medium text-muted">Syncing...</Text>
        ) : null}
      </View>
      <Text className="mt-3 text-xs text-muted">Scope</Text>
      <Text
        className="text-sm font-medium text-foreground"
        numberOfLines={1}
      >
        {scopeLabel}
      </Text>
      <View className="mt-3 flex-row gap-6">
        <Stat label="Pending" value={String(pendingCount)} />
        <Stat label="Rejected" value={String(rejectedCount)} />
        <Stat
          label="Last sync"
          value={lastSyncAt ? relativeTime(lastSyncAt) : "Never"}
        />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-base font-semibold text-foreground">{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  tone: "primary" | "surface" | "danger";
  onPress: () => void;
  disabled?: boolean;
}) {
  const bg =
    tone === "primary"
      ? "bg-foreground"
      : tone === "danger"
        ? "bg-danger/10"
        : "bg-surface";
  const text =
    tone === "primary"
      ? "text-background"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-2xl ${bg} px-5 py-4 items-center`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Text className={`text-base font-semibold ${text}`}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="px-5 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
      {label}
    </Text>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="mx-5 rounded-2xl bg-surface p-4">
      <Text className="text-sm text-muted">{text}</Text>
    </View>
  );
}

function BraceletGroup({
  wristbandUid,
  debits,
}: {
  wristbandUid: string;
  debits: LocalDebit[];
}) {
  return (
    <View className="mx-5 mt-2 rounded-2xl bg-surface p-3">
      <Text
        className="px-1 text-xs font-semibold text-muted"
        numberOfLines={1}
      >
        Bracelet {wristbandUid}
      </Text>
      {debits.map((d) => (
        <DebitRow key={d.wire.idempotencyKey} debit={d} />
      ))}
    </View>
  );
}

function DebitRow({ debit }: { debit: LocalDebit }) {
  return (
    <View className="flex-row items-center justify-between py-2 px-1">
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">
          {formatCents(debit.wire.amount)} RON
        </Text>
        <Text className="text-xs text-muted">
          counter #{debit.wire.counterValue} - {relativeTime(debit.enqueuedAt)}
        </Text>
        {debit.rejectionReason ? (
          <Text className="text-xs text-danger">
            {rejectionLabel(debit.rejectionReason)}
          </Text>
        ) : null}
      </View>
      <Text className="text-xs text-muted">
        {debit.wire.idempotencyKey.slice(0, 8)}
      </Text>
    </View>
  );
}

function SyncResponseSummary({ response }: { response: SyncResponse }) {
  return (
    <View className="gap-2">
      <KV
        label="Server balance"
        value={`${formatCents(response.serverState.balance)} RON`}
      />
      <KV
        label="Debit counter seen"
        value={String(response.serverState.debit_counter_seen)}
      />
      <KV
        label="Credit counter"
        value={String(response.serverState.credit_counter)}
      />
      <KV label="Applied" value={String(response.applied.length)} />
      <KV label="Rejected" value={String(response.rejected.length)} />
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs font-medium text-foreground">{value}</Text>
    </View>
  );
}

function rejectionLabel(reason: RejectReason): string {
  switch (reason) {
    case "duplicate":
      return "Already applied";
    case "insufficient_funds":
      return "Insufficient funds at sync";
    case "counter_gap":
      return "Counter sequence gap";
    case "invalid":
      return "Rejected as invalid";
  }
}

function groupByWristband(
  debits: LocalDebit[],
): Record<string, LocalDebit[]> {
  const map: Record<string, LocalDebit[]> = {};
  for (const d of debits) {
    if (!map[d.wristbandUid]) map[d.wristbandUid] = [];
    map[d.wristbandUid].push(d);
  }
  return map;
}

function formatCents(cents: number): string {
  const value = cents / 100;
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
