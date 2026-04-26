import { extractErrorMessage } from "../api";
import { reconciliationApi } from "../api/reconciliation";
import type { ChipState } from "../chip";
import type { ChipStateWire, SyncResponse } from "@/types/sync";

import { applyServerOutcome, listDebits } from "./queue-store";
import type { LocalDebit, QueueScope, SyncOutcome } from "./types";

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
