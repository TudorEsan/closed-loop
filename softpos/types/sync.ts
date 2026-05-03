// Mirrors backend/src/modules/reconciliation/dto/sync.dto.ts and the
// SyncResponse type from reconciliation.service.ts. Keep field names exact.

export type ChipStateWire = {
  balance: number;
  debit_counter: number;
  credit_counter_seen: number;
};

export type PendingDebitWire = {
  idempotencyKey: string;
  amount: number;
  vendorId: string;
  counterValue: number;
  deviceId: string;
  clientTimestamp: string;
};

export type SyncRequest = {
  pendingDebits: PendingDebitWire[];
};

export type RejectReason =
  | "duplicate"
  | "insufficient_funds"
  | "counter_gap"
  | "invalid";

export type RejectedDebit = {
  idempotencyKey: string;
  reason: RejectReason;
};

export type SyncResponse = {
  serverState: {
    balance: number;
    debit_counter_seen: number;
    credit_counter: number;
  };
  applied: string[];
  rejected: RejectedDebit[];
  chipShouldWrite: {
    balance: number;
    credit_counter: number;
  };
};
