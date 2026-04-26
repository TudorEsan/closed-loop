// Chip record layout. 28 bytes total.
// 0..3   balance              uint32 little-endian (cents)
// 4..7   debit_counter        uint32 little-endian
// 8..11  credit_counter_seen  uint32 little-endian
// 12..27 hmac                 HMAC-SHA256 truncated to 16 bytes

export const CHIP_RECORD_SIZE = 28;
export const CHIP_PAYLOAD_SIZE = 12;
export const CHIP_HMAC_SIZE = 16;

export type ChipRecord = {
  balance: number;
  debitCounter: number;
  creditCounterSeen: number;
  hmac: Uint8Array;
};

function writeUint32LE(view: DataView, offset: number, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Value at offset ${offset} is not a valid uint32: ${value}`);
  }
  view.setUint32(offset, value, true);
}

export function encodeChipPayload(args: {
  balance: number;
  debitCounter: number;
  creditCounterSeen: number;
}): Uint8Array {
  const out = new Uint8Array(CHIP_PAYLOAD_SIZE);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  writeUint32LE(view, 0, args.balance);
  writeUint32LE(view, 4, args.debitCounter);
  writeUint32LE(view, 8, args.creditCounterSeen);
  return out;
}

export function encodeChipRecord(record: ChipRecord): Uint8Array {
  if (record.hmac.length !== CHIP_HMAC_SIZE) {
    throw new Error(
      `HMAC must be ${CHIP_HMAC_SIZE} bytes, got ${record.hmac.length}`,
    );
  }
  const out = new Uint8Array(CHIP_RECORD_SIZE);
  out.set(
    encodeChipPayload({
      balance: record.balance,
      debitCounter: record.debitCounter,
      creditCounterSeen: record.creditCounterSeen,
    }),
    0,
  );
  out.set(record.hmac, CHIP_PAYLOAD_SIZE);
  return out;
}

export function decodeChipRecord(bytes: Uint8Array): ChipRecord {
  if (bytes.length < CHIP_RECORD_SIZE) {
    throw new Error(
      `Chip record too short: expected ${CHIP_RECORD_SIZE} bytes, got ${bytes.length}`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const balance = view.getUint32(0, true);
  const debitCounter = view.getUint32(4, true);
  const creditCounterSeen = view.getUint32(8, true);
  const hmac = bytes.slice(CHIP_PAYLOAD_SIZE, CHIP_RECORD_SIZE);
  return { balance, debitCounter, creditCounterSeen, hmac };
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      BASE64_CHARS[(triplet >> 18) & 0x3f] +
      BASE64_CHARS[(triplet >> 12) & 0x3f] +
      BASE64_CHARS[(triplet >> 6) & 0x3f] +
      BASE64_CHARS[triplet & 0x3f];
  }
  if (i < bytes.length) {
    const remaining = bytes.length - i;
    const a = bytes[i];
    const b = remaining > 1 ? bytes[i + 1] : 0;
    const triplet = (a << 16) | (b << 8);
    result += BASE64_CHARS[(triplet >> 18) & 0x3f];
    result += BASE64_CHARS[(triplet >> 12) & 0x3f];
    result += remaining > 1 ? BASE64_CHARS[(triplet >> 6) & 0x3f] : '=';
    result += '=';
  }
  return result;
}

export function base64ToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = (cleaned.match(/=+$/) ?? [''])[0].length;
  const len = (cleaned.length / 4) * 3 - padding;
  const bytes = new Uint8Array(len);
  let outIndex = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(cleaned[i]);
    const c2 = BASE64_CHARS.indexOf(cleaned[i + 1]);
    const c3 = cleaned[i + 2] === '=' ? 0 : BASE64_CHARS.indexOf(cleaned[i + 2]);
    const c4 = cleaned[i + 3] === '=' ? 0 : BASE64_CHARS.indexOf(cleaned[i + 3]);
    const triplet = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    if (outIndex < len) bytes[outIndex++] = (triplet >> 16) & 0xff;
    if (outIndex < len) bytes[outIndex++] = (triplet >> 8) & 0xff;
    if (outIndex < len) bytes[outIndex++] = triplet & 0xff;
  }
  return bytes;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
