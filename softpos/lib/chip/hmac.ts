import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { CHIP_HMAC_SIZE, hexToBytes } from './layout';

const BRACELET_INFO = new TextEncoder().encode('bracelet-v1');

function getMasterKey(): Uint8Array {
  const raw = process.env.EXPO_PUBLIC_BRACELET_SIGNING_KEY ?? '';
  if (!raw) {
    // Fail loud during dev so the demo key is configured. In production
    // these keys come from device attestation, not from a public env var.
    throw new Error(
      'EXPO_PUBLIC_BRACELET_SIGNING_KEY is not set. Configure the demo master key.',
    );
  }
  // Accept either hex or plain ascii. Hex when it looks like one.
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    return hexToBytes(raw);
  }
  return new TextEncoder().encode(raw);
}

function uidToBytes(uid: string): Uint8Array {
  const compact = uid.replace(/[^0-9a-fA-F]/g, '');
  if (compact.length > 0 && compact.length % 2 === 0) {
    return hexToBytes(compact);
  }
  return new TextEncoder().encode(uid);
}

export async function deriveBraceletKey(uid: string): Promise<Uint8Array> {
  const master = getMasterKey();
  const salt = uidToBytes(uid);
  return hkdf(sha256, master, salt, BRACELET_INFO, 32);
}

export async function computeChipHmac(
  payload: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  const full = hmac(sha256, key, payload);
  return full.slice(0, CHIP_HMAC_SIZE);
}
