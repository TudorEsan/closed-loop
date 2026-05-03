import type { PendingDebitWire, RejectReason, SyncResponse } from "@/types/sync";

// Stored on the device. The wire shape (matches reconciliation.dto.ts) lives
// inside `wire`. Local-only metadata sits next to it so the debug UI can
// show status without changing the contract sent to the server.
export type LocalDebit = {
  wire: PendingDebitWire;
  enqueuedAt: string;
  wristbandUid: string;
  status: "pending" | "rejected";
  rejectionReason?: RejectReason;
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
