import { extractErrorMessage } from "../api";
import { reconciliationApi } from "../api/reconciliation";
import type { SyncResponse } from "@/types/sync";

import { applyServerOutcome, listDebits } from "./queue-store";
import type { LocalDebit, QueueScope, SyncOutcome } from "./types";

export type AutoSyncOutcome =
  | { ok: true; wristbandUid: string; response: SyncResponse }
  | { ok: false; wristbandUid: string; error: string };

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
): Promise<SyncOutcome> {
  const pending = await pendingForBracelet(scope, wristbandUid);
  const sortedWire = [...pending]
    .sort((a, b) => a.wire.counterValue - b.wire.counterValue)
    .map((d) => d.wire);

  let response: SyncResponse;
  try {
    response = await reconciliationApi.sync(scope.eventId, wristbandUid, {
      pendingDebits: sortedWire,
    });
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e) };
  }

  await applyServerOutcome(scope, response.applied, response.rejected);
  return { ok: true, response };
}

// Auto-sync without NFC. The chip itself is not rewritten here;
// reconciliation happens on the next online charge tap.
export async function runAutoSyncForBracelet(
  scope: QueueScope,
  wristbandUid: string,
): Promise<AutoSyncOutcome> {
  const pending = await pendingForBracelet(scope, wristbandUid);
  if (pending.length === 0) {
    return { ok: false, wristbandUid, error: "Nothing pending to sync" };
  }
  const sortedWire = [...pending]
    .sort((a, b) => a.wire.counterValue - b.wire.counterValue)
    .map((d) => d.wire);

  let response: SyncResponse;
  try {
    response = await reconciliationApi.sync(scope.eventId, wristbandUid, {
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
