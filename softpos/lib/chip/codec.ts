import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { deriveBraceletKey } from "./key";

export const CHIP_BLOB_SIZE = 28;
export const HMAC_TAG_SIZE = 16;
export const CHIP_BODY_SIZE = 12;

const OFFSET_BALANCE = 0;
const OFFSET_DEBIT_COUNTER = 4;
const OFFSET_CREDIT_COUNTER_SEEN = 8;
const OFFSET_HMAC = 12;

export type ChipState = {
  balance: number;
  debitCounter: number;
  creditCounterSeen: number;
};

export type ChipBlobErrorReason =
  | "size"
  | "hmac"
  | "uninitialized"
  | "out_of_range";

export class ChipBlobError extends Error {
  readonly reason: ChipBlobErrorReason;
  constructor(reason: ChipBlobErrorReason, message: string) {
    super(message);
    this.name = "ChipBlobError";
    this.reason = reason;
  }
}

export function encodeChipBlob(
  state: ChipState,
  wristbandUid: string,
): Uint8Array {
  assertU32(state.balance, "balance");
  assertU32(state.debitCounter, "debitCounter");
  assertU32(state.creditCounterSeen, "creditCounterSeen");

  const blob = new Uint8Array(CHIP_BLOB_SIZE);
  const view = new DataView(blob.buffer);
  view.setUint32(OFFSET_BALANCE, state.balance, true);
  view.setUint32(OFFSET_DEBIT_COUNTER, state.debitCounter, true);
  view.setUint32(OFFSET_CREDIT_COUNTER_SEEN, state.creditCounterSeen, true);

  const key = deriveBraceletKey(wristbandUid);
  const tag = hmac(sha256, key, blob.subarray(0, CHIP_BODY_SIZE)).subarray(
    0,
    HMAC_TAG_SIZE,
  );
  blob.set(tag, OFFSET_HMAC);
  return blob;
}

export function decodeChipBlob(
  bytes: Uint8Array,
  wristbandUid: string,
): ChipState {
  if (bytes.length < CHIP_BLOB_SIZE) {
    throw new ChipBlobError(
      "size",
      `Chip blob too short: expected ${CHIP_BLOB_SIZE}, got ${bytes.length}`,
    );
  }

  const blob =
    bytes.length === CHIP_BLOB_SIZE ? bytes : bytes.subarray(0, CHIP_BLOB_SIZE);

  if (isAllZero(blob)) {
    throw new ChipBlobError("uninitialized", "Bracelet not initialized");
  }

  const key = deriveBraceletKey(wristbandUid);
  const expected = hmac(sha256, key, blob.subarray(0, CHIP_BODY_SIZE)).subarray(
    0,
    HMAC_TAG_SIZE,
  );
  const actual = blob.subarray(OFFSET_HMAC, OFFSET_HMAC + HMAC_TAG_SIZE);
  if (!constantTimeEqual(expected, actual)) {
    throw new ChipBlobError("hmac", "Chip signature does not match");
  }

  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  return {
    balance: view.getUint32(OFFSET_BALANCE, true),
    debitCounter: view.getUint32(OFFSET_DEBIT_COUNTER, true),
    creditCounterSeen: view.getUint32(OFFSET_CREDIT_COUNTER_SEEN, true),
  };
}

function assertU32(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xff_ff_ff_ff
  ) {
    throw new ChipBlobError(
      "out_of_range",
      `${field} out of u32 range: ${value}`,
    );
  }
}

function isAllZero(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
