import type {
  ChipStateWire,
  PendingDebitWire,
  RejectReason,
  SyncResponse,
} from "@/types/sync";

// Stored on the device. The wire shape (matches reconciliation.dto.ts) lives
// inside `wire`. Local-only metadata sits next to it so the debug UI can
// show status without changing the contract sent to the server.
export type LocalDebit = {
  wire: PendingDebitWire;
  enqueuedAt: string;
  wristbandUid: string;
  status: "pending" | "rejected";
  rejectionReason?: RejectReason;
  // Snapshot of the chip state after this debit was applied locally
  // (balance / debit_counter / credit_counter_seen we wrote to the chip).
  // Lets the auto-sync flow POST /sync without re-tapping the bracelet.
  chipStateAfter?: ChipStateWire;
};

export type QueueScope = {
  eventId: string;
  vendorId: string;
};

export type SyncOutcome = {
  ok: true;
  response: SyncResponse;
} | {
  ok: false;
  error: string;
};
