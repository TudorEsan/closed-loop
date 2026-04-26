import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { config } from "../config";

const INFO = new TextEncoder().encode("bracelet-v1");

export function getMasterKey(): Uint8Array {
  return hexToBytes(config.braceletMasterKeyHex);
}

export function deriveBraceletKey(wristbandUid: string): Uint8Array {
  const ikm = getMasterKey();
  const salt = new TextEncoder().encode(wristbandUid);
  return hkdf(sha256, ikm, salt, INFO, 32);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error("Master key hex must have an even length");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("Master key has non-hex chars");
    out[i] = byte;
  }
  return out;
}
