import { useCallback, useState } from 'react';

import {
  CHIP_RECORD_SIZE,
  bytesToBase64,
  encodeChipPayload,
  encodeChipRecord,
} from '@/lib/chip/layout';
import { computeChipHmac, deriveBraceletKey } from '@/lib/chip/hmac';

type NfcManagerType = typeof import('react-native-nfc-manager').default;
type NdefType = typeof import('react-native-nfc-manager').Ndef;
type NfcTechType = typeof import('react-native-nfc-manager').NfcTech;

let NfcManager: NfcManagerType | null = null;
let Ndef: NdefType | null = null;
let NfcTech: NfcTechType | null = null;
try {
  const mod = require('react-native-nfc-manager');
  NfcManager = mod.default;
  Ndef = mod.Ndef;
  NfcTech = mod.NfcTech;
} catch {
  NfcManager = null;
}

export type WriteRecordInput = {
  uid: string;
  balance: number;
  debitCounter: number;
  creditCounterSeen: number;
};

export type NfcWriteResult = {
  ok: boolean;
  error?: string;
  canceled?: boolean;
};

async function buildBytes(input: WriteRecordInput): Promise<Uint8Array> {
  const payload = encodeChipPayload({
    balance: input.balance,
    debitCounter: input.debitCounter,
    creditCounterSeen: input.creditCounterSeen,
  });
  const key = await deriveBraceletKey(input.uid);
  const hmac = await computeChipHmac(payload, key);
  return encodeChipRecord({
    balance: input.balance,
    debitCounter: input.debitCounter,
    creditCounterSeen: input.creditCounterSeen,
    hmac,
  });
}

export function useNfcWrite() {
  const [isWriting, setIsWriting] = useState(false);

  const write = useCallback(
    async (input: WriteRecordInput): Promise<NfcWriteResult> => {
      if (!NfcManager || !NfcTech || !Ndef) {
        return { ok: false, error: 'NFC is not available on this device' };
      }
      setIsWriting(true);
      try {
        const bytes = await buildBytes(input);
        if (bytes.length !== CHIP_RECORD_SIZE) {
          return { ok: false, error: 'Failed to build chip record' };
        }
        const text = bytesToBase64(bytes);
        const ndefBytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
        if (!ndefBytes) {
          return { ok: false, error: 'Failed to encode NDEF message' };
        }
        await NfcManager.start();
        await NfcManager.requestTechnology(NfcTech.Ndef);
        await NfcManager.ndefHandler.writeNdefMessage(ndefBytes);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'NFC write failed';
        const canceled = /cancel/i.test(msg);
        return {
          ok: false,
          error: canceled ? undefined : msg,
          canceled,
        };
      } finally {
        try {
          await NfcManager.cancelTechnologyRequest();
        } catch {
          // ignore
        }
        setIsWriting(false);
      }
    },
    [],
  );

  const cancel = useCallback(async () => {
    if (!NfcManager) return;
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // ignore
    }
    setIsWriting(false);
  }, []);

  return { write, cancel, isWriting };
}
