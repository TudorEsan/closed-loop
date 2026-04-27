import { type ChipState } from "@/lib/chip";
import { type NfcReadWriteResult } from "@/hooks/use-nfc";

export type Mode = "online" | "offline";
export type Step = "amount" | "tap" | "submitting" | "done" | "error";
export type NfcFailure = Exclude<NfcReadWriteResult, { kind: "ok" }>;

export type DoneInfo = {
  amount: number;
  mode: Mode;
  chipState?: ChipState;
};

export const MIN_AMOUNT = 1;
