import { type ChipBlobErrorReason } from "@/lib/chip";
import { type Mode } from "./types";

export function formatAmount(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatWithCommas(amount: string): string {
  if (amount.length === 0) return "0";
  const [intPart, decPart] = amount.split(".");
  const intNum = parseInt(intPart || "0", 10);
  const intFormatted = Number.isFinite(intNum)
    ? intNum.toLocaleString("en-US")
    : intPart || "0";
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
}

export function blankMessage(reason: ChipBlobErrorReason, mode: Mode): string {
  if (reason === "uninitialized") {
    return mode === "online"
      ? "Bracelet not initialized. Link it first."
      : "Bracelet not initialized. Connect to network first to set it up.";
  }
  return mode === "online"
    ? "Bracelet signature does not match."
    : "Bracelet signature does not match. Cannot charge offline.";
}
