import { useCallback, useState } from 'react';

import { extractErrorMessage } from '@/lib/api';
import {
  CHIP_RECORD_SIZE,
  base64ToBytes,
  bytesEqual,
  decodeChipRecord,
  encodeChipPayload,
} from '@/lib/chip/layout';
import { computeChipHmac, deriveBraceletKey } from '@/lib/chip/hmac';

type NfcManagerType = typeof import('react-native-nfc-manager').default;
type NfcTechType = typeof import('react-native-nfc-manager').NfcTech;

let NfcManager: NfcManagerType | null = null;
let NfcTech: NfcTechType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-nfc-manager');
  NfcManager = mod.default;
  NfcTech = mod.NfcTech;
} catch {
  NfcManager = null;
}

export type ChipRecordView = {
  balance: number;
  debitCounter: number;
  creditCounterSeen: number;
};

export type NfcReadResult = {
  uid: string | null;
  chipRecord: ChipRecordView | null;
  rawBytes: Uint8Array | null;
  error?: string;
  canceled?: boolean;
};

export type UseNfcReadValue = {
  isAvailable: boolean;
  isScanning: boolean;
  error: string | null;
  read: () => Promise<NfcReadResult>;
  cancel: () => Promise<void>;
  clearError: () => void;
};

type TagShape = {
  id?: string;
  ndefMessage?: { payload?: number[] | Uint8Array; type?: number[] | Uint8Array }[];
};

function extractNdefPayload(tag: TagShape): Uint8Array | null {
  const records = tag.ndefMessage;
  if (!records || records.length === 0) return null;
  const record = records[0];
  const payload = record?.payload;
  if (!payload) return null;
  const bytes = payload instanceof Uint8Array ? payload : Uint8Array.from(payload);
  if (bytes.length === 0) return null;
  const status = bytes[0];
  const langLen = status & 0x3f;
  const textStart = 1 + langLen;
  if (textStart >= bytes.length) return null;
  const textBytes = bytes.slice(textStart);
  let text = '';
  for (let i = 0; i < textBytes.length; i++) text += String.fromCharCode(textBytes[i]);
  try {
    return base64ToBytes(text);
  } catch {
    return null;
  }
}

async function verifyHmac(uid: string, raw: Uint8Array): Promise<ChipRecordView | null> {
  if (raw.length < CHIP_RECORD_SIZE) return null;
  const trimmed = raw.slice(0, CHIP_RECORD_SIZE);
  const decoded = decodeChipRecord(trimmed);
  const payload = encodeChipPayload({
    balance: decoded.balance,
    debitCounter: decoded.debitCounter,
    creditCounterSeen: decoded.creditCounterSeen,
  });
  const key = await deriveBraceletKey(uid);
  const expected = await computeChipHmac(payload, key);
  if (!bytesEqual(expected, decoded.hmac)) return null;
  return {
    balance: decoded.balance,
    debitCounter: decoded.debitCounter,
    creditCounterSeen: decoded.creditCounterSeen,
  };
}

export function useNfcRead(): UseNfcReadValue {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAvailable = !!(NfcManager && NfcTech);

  const read = useCallback(async (): Promise<NfcReadResult> => {
    if (!NfcManager || !NfcTech) {
      return {
        uid: null,
        chipRecord: null,
        rawBytes: null,
        error: 'NFC is not available on this device',
      };
    }
    setError(null);
    setIsScanning(true);
    try {
      await NfcManager.start();
      await NfcManager.requestTechnology(NfcTech.NfcA);
      const tag = (await NfcManager.getTag()) as TagShape | null;
      const uid = tag?.id ?? null;
      if (!uid) {
        const msg = 'Could not read the tag UID';
        setError(msg);
        return { uid: null, chipRecord: null, rawBytes: null, error: msg };
      }
      const raw = tag ? extractNdefPayload(tag) : null;
      if (!raw) {
        return { uid, chipRecord: null, rawBytes: null };
      }
      const verified = await verifyHmac(uid, raw);
      if (!verified) {
        const msg = 'Chip signature did not verify';
        setError(msg);
        return { uid, chipRecord: null, rawBytes: raw, error: msg };
      }
      return { uid, chipRecord: verified, rawBytes: raw };
    } catch (err) {
      const msg = extractErrorMessage(err);
      const canceled = msg ? /cancel/i.test(msg) : false;
      if (canceled) {
        return { uid: null, chipRecord: null, rawBytes: null, canceled: true };
      }
      setError(msg);
      return { uid: null, chipRecord: null, rawBytes: null, error: msg };
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        // ignore
      }
      setIsScanning(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    if (!NfcManager) return;
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // ignore
    }
    setIsScanning(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { isAvailable, isScanning, error, read, cancel, clearError };
}
