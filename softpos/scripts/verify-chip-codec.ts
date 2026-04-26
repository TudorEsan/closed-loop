// Self-test for the chip codec. Run via:
//   cd softpos && npx tsx scripts/verify-chip-codec.ts
//
// Verifies round-trip encode/decode for three vectors and that a single
// flipped byte is rejected with a ChipBlobError.

import {
  CHIP_BLOB_SIZE,
  ChipBlobError,
  decodeChipBlob,
  encodeChipBlob,
  type ChipState,
} from "../lib/chip";

type Vector = {
  uid: string;
  state: ChipState;
};

const vectors: Vector[] = [
  {
    uid: "04AABBCCDDEE80",
    state: { balance: 50000, debitCounter: 0, creditCounterSeen: 1 },
  },
  {
    uid: "04112233445566",
    state: { balance: 0, debitCounter: 12345, creditCounterSeen: 7 },
  },
  {
    uid: "0499887766FFEE",
    state: {
      balance: 0xff_ff_ff_ff,
      debitCounter: 0xff_ff_ff_ff,
      creditCounterSeen: 0xff_ff_ff_ff,
    },
  },
];

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  pass  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("Chip codec self-test\n");

for (const v of vectors) {
  console.log(`vector uid=${v.uid}`);
  const blob = encodeChipBlob(v.state, v.uid);
  check("blob is 28 bytes", blob.length === CHIP_BLOB_SIZE);
  const round = decodeChipBlob(blob, v.uid);
  check(
    "round-trip equal",
    round.balance === v.state.balance &&
      round.debitCounter === v.state.debitCounter &&
      round.creditCounterSeen === v.state.creditCounterSeen,
    `${JSON.stringify(round)} !== ${JSON.stringify(v.state)}`,
  );

  const tampered = new Uint8Array(blob);
  tampered[0] ^= 0x01;
  let threwHmac = false;
  try {
    decodeChipBlob(tampered, v.uid);
  } catch (e) {
    threwHmac = e instanceof ChipBlobError && e.reason === "hmac";
  }
  check("tampered body rejected with reason=hmac", threwHmac);

  const tamperedTag = new Uint8Array(blob);
  tamperedTag[CHIP_BLOB_SIZE - 1] ^= 0x80;
  let threwTag = false;
  try {
    decodeChipBlob(tamperedTag, v.uid);
  } catch (e) {
    threwTag = e instanceof ChipBlobError && e.reason === "hmac";
  }
  check("tampered tag rejected with reason=hmac", threwTag);

  let threwUninit = false;
  try {
    decodeChipBlob(new Uint8Array(CHIP_BLOB_SIZE), v.uid);
  } catch (e) {
    threwUninit = e instanceof ChipBlobError && e.reason === "uninitialized";
  }
  check("zeroed blob rejected as uninitialized", threwUninit);

  let threwSize = false;
  try {
    decodeChipBlob(new Uint8Array(10), v.uid);
  } catch (e) {
    threwSize = e instanceof ChipBlobError && e.reason === "size";
  }
  check("short blob rejected as size", threwSize);

  console.log("");
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("All checks passed.");
