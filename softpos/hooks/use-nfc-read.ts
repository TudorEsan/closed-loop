import { useCallback, useState } from 'react';

import { extractErrorMessage } from '@/lib/api';

let NfcManager: typeof import('react-native-nfc-manager').default | null = null;
let NfcTech: typeof import('react-native-nfc-manager').NfcTech | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-nfc-manager');
  NfcManager = mod.default;
  NfcTech = mod.NfcTech;
} catch {
  NfcManager = null;
}

export type NfcReadResult = {
  uid: string | null;
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

export function useNfcRead(): UseNfcReadValue {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAvailable = !!(NfcManager && NfcTech);

  const read = useCallback(async (): Promise<NfcReadResult> => {
    if (!NfcManager || !NfcTech) {
      return { uid: null, error: 'NFC is not available on this device' };
    }
    setError(null);
    setIsScanning(true);
    try {
      await NfcManager.start();
      await NfcManager.requestTechnology(NfcTech.NfcA);
      const tag = await NfcManager.getTag();
      const uid = tag?.id ?? null;
      if (!uid) throw new Error('Could not read the tag UID');
      return { uid };
    } catch (e) {
      const msg = extractErrorMessage(e);
      if (msg && /cancel/i.test(msg)) {
        return { uid: null, canceled: true };
      }
      setError(msg);
      return { uid: null, error: msg };
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
