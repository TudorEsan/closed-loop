import { extractErrorMessage } from "../api";
import { reconciliationApi } from "../api/reconciliation";
import type { ChipState } from "../chip";
import type { ChipStateWire, SyncResponse } from "@/types/sync";

import { applyServerOutcome, listDebits } from "./queue-store";
import type { LocalDebit, QueueScope, SyncOutcome } from "./types";

export type AutoSyncOutcome =
  | { ok: true; wristbandUid: string; response: SyncResponse }
  | { ok: false; wristbandUid: string; error: string }
  | { ok: false; wristbandUid: string; skipped: "no-chip-snapshot" };

export type SyncDeps = {
  chipState: ChipState;
  writeChipBack(state: ChipState): Promise<void>;
};

export async function pendingForBracelet(
  scope: QueueScope,
  wristbandUid: string,
): Promise<LocalDebit[]> {
  const all = await listDebits(scope);
  return all.filter(
    (d) => d.wristbandUid === wristbandUid && d.status === "pending",
  );
}

export async function runSyncForBracelet(
  scope: QueueScope,
  wristbandUid: string,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const pending = await pendingForBracelet(scope, wristbandUid);
  const sortedWire = [...pending]
    .sort((a, b) => a.wire.counterValue - b.wire.counterValue)
    .map((d) => d.wire);

  let response: SyncResponse;
  try {
    response = await reconciliationApi.sync(scope.eventId, wristbandUid, {
      chipState: toWire(deps.chipState),
      pendingDebits: sortedWire,
    });
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e) };
  }

  await applyServerOutcome(scope, response.applied, response.rejected);

  try {
    await deps.writeChipBack({
      balance: response.chipShouldWrite.balance,
      debitCounter: response.serverState.debit_counter_seen,
      creditCounterSeen: response.chipShouldWrite.credit_counter,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Server applied debits but chip write failed: ${extractErrorMessage(e)}`,
    };
  }

  return { ok: true, response };
}

function toWire(state: ChipState): ChipStateWire {
  return {
    balance: state.balance,
    debit_counter: state.debitCounter,
    credit_counter_seen: state.creditCounterSeen,
  };
}

// Auto-sync without NFC. Uses the snapshot stored alongside the latest
// pending debit (the chip state we wrote at debit time). The chip itself
// is not rewritten here; reconciliation happens on the next charge tap
// (online charge already writes chipShouldWrite back to the chip).
export async function runAutoSyncForBracelet(
  scope: QueueScope,
  wristbandUid: string,
): Promise<AutoSyncOutcome> {
  const pending = await pendingForBracelet(scope, wristbandUid);
  if (pending.length === 0) {
    return { ok: false, wristbandUid, skipped: "no-chip-snapshot" };
  }
  const latest = pending.reduce((a, b) =>
    a.wire.counterValue >= b.wire.counterValue ? a : b,
  );
  if (!latest.chipStateAfter) {
    return { ok: false, wristbandUid, skipped: "no-chip-snapshot" };
  }
  const sortedWire = [...pending]
    .sort((a, b) => a.wire.counterValue - b.wire.counterValue)
    .map((d) => d.wire);

  let response: SyncResponse;
  try {
    response = await reconciliationApi.sync(scope.eventId, wristbandUid, {
      chipState: latest.chipStateAfter,
      pendingDebits: sortedWire,
    });
  } catch (e) {
    return { ok: false, wristbandUid, error: extractErrorMessage(e) };
  }

  await applyServerOutcome(scope, response.applied, response.rejected);
  return { ok: true, wristbandUid, response };
}

export async function uniquePendingBracelets(
  scope: QueueScope,
): Promise<string[]> {
  const all = await listDebits(scope);
  const set = new Set<string>();
  for (const d of all) {
    if (d.status === "pending") set.add(d.wristbandUid);
  }
  return [...set];
}
