import { useCallback, useState } from "react";

import { extractErrorMessage } from "@/lib/api";
import {
  CHIP_BLOB_SIZE,
  ChipBlobError,
  type ChipBlobErrorReason,
  type ChipState,
  decodeChipBlob,
  encodeChipBlob,
} from "@/lib/chip";
import {
  NFC_AVAILABLE,
  cancelActiveSession,
  withSession,
} from "@/lib/nfc/transport";

const CHIP_USER_PAGE = 4;
const READ_BYTES = 32; // 8 pages of 4 bytes; first 28 are the chip blob

export type NfcReadResult = {
  uid: string | null;
  error?: string;
  canceled?: boolean;
};

export type NfcReadBraceletResult =
  | { kind: "ok"; uid: string; chipState: ChipState }
  | { kind: "blank"; uid: string; reason: ChipBlobErrorReason }
  | { kind: "error"; uid: string | null; error: string }
  | { kind: "canceled" };

export type NfcWriteResult =
  | { kind: "ok" }
  | { kind: "error"; error: string }
  | { kind: "canceled" };

export type ChipTransform = (
  state: ChipState,
  uid: string,
) =>
  | Promise<ChipState | { abort: string }>
  | ChipState
  | { abort: string };

export type NfcReadWriteResult =
  | { kind: "ok"; uid: string; prev: ChipState; next: ChipState }
  | { kind: "blank"; uid: string; reason: ChipBlobErrorReason }
  | { kind: "aborted"; uid: string; reason: string; prev: ChipState }
  | { kind: "error"; uid: string | null; error: string }
  | { kind: "canceled" };

export type NfcInitResult =
  | { kind: "ok"; uid: string }
  | { kind: "already-initialized"; uid: string; chipState: ChipState }
  | { kind: "error"; uid: string | null; error: string }
  | { kind: "canceled" };

export type UseNfcValue = {
  isAvailable: boolean;
  isBusy: boolean;
  error: string | null;
  clearError(): void;
  cancel(): Promise<void>;
  readUid(): Promise<NfcReadResult>;
  readBracelet(): Promise<NfcReadBraceletResult>;
  writeChipState(uid: string, state: ChipState): Promise<NfcWriteResult>;
  readWriteBracelet(transform: ChipTransform): Promise<NfcReadWriteResult>;
  initializeBracelet(): Promise<NfcInitResult>;
  resetBracelet(): Promise<NfcInitResult>;
};

export function useNfc(): UseNfcValue {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readUid = useCallback(async (): Promise<NfcReadResult> => {
    if (!NFC_AVAILABLE) {
      return { uid: null, error: "NFC is not available on this device" };
    }
    setError(null);
    setIsBusy(true);
    try {
      const uid = await withSession(async (s) => s.readUid());
      return { uid };
    } catch (e) {
      return mapError<NfcReadResult>(e, (msg) => ({ uid: null, error: msg }), {
        uid: null,
        canceled: true,
      });
    } finally {
      setIsBusy(false);
    }
  }, []);

  const readBracelet =
    useCallback(async (): Promise<NfcReadBraceletResult> => {
      if (!NFC_AVAILABLE) {
        return {
          kind: "error",
          uid: null,
          error: "NFC is not available on this device",
        };
      }
      setError(null);
      setIsBusy(true);
      try {
        const { uid, bytes } = await withSession(async (s) => {
          const u = await s.readUid();
          const b = await s.readPages(CHIP_USER_PAGE, READ_BYTES / 4);
          return { uid: u, bytes: b.subarray(0, CHIP_BLOB_SIZE) };
        });
        try {
          const chipState = decodeChipBlob(bytes, uid);
          return { kind: "ok", uid, chipState };
        } catch (e) {
          if (e instanceof ChipBlobError) {
            return { kind: "blank", uid, reason: e.reason };
          }
          throw e;
        }
      } catch (e) {
        return mapError<NfcReadBraceletResult>(
          e,
          (msg) => ({ kind: "error", uid: null, error: msg }),
          { kind: "canceled" },
        );
      } finally {
        setIsBusy(false);
      }
    }, []);

  const writeChipState = useCallback(
    async (uid: string, state: ChipState): Promise<NfcWriteResult> => {
      if (!NFC_AVAILABLE) {
        return { kind: "error", error: "NFC is not available on this device" };
      }
      setError(null);
      setIsBusy(true);
      try {
        const blob = encodeChipBlob(state, uid);
        await withSession(async (s) => {
          const onChip = await s.readUid();
          if (onChip !== uid) {
            throw new Error("Different bracelet detected, write aborted");
          }
          await s.writePages(CHIP_USER_PAGE, blob);
        });
        return { kind: "ok" };
      } catch (e) {
        return mapError<NfcWriteResult>(
          e,
          (msg) => ({ kind: "error", error: msg }),
          { kind: "canceled" },
        );
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  const readWriteBracelet = useCallback(
    async (transform: ChipTransform): Promise<NfcReadWriteResult> => {
      if (!NFC_AVAILABLE) {
        return {
          kind: "error",
          uid: null,
          error: "NFC is not available on this device",
        };
      }
      setError(null);
      setIsBusy(true);
      try {
        return await withSession<NfcReadWriteResult>(async (s) => {
          const uid = await s.readUid();
          const bytes = await s.readPages(CHIP_USER_PAGE, READ_BYTES / 4);
          const blob = bytes.subarray(0, CHIP_BLOB_SIZE);
          let prev: ChipState;
          try {
            prev = decodeChipBlob(blob, uid);
          } catch (e) {
            if (e instanceof ChipBlobError) {
              return { kind: "blank", uid, reason: e.reason };
            }
            throw e;
          }
          const decision = await transform(prev, uid);
          if ("abort" in decision) {
            return { kind: "aborted", uid, reason: decision.abort, prev };
          }
          const next = decision;
          const newBlob = encodeChipBlob(next, uid);
          await s.writePages(CHIP_USER_PAGE, newBlob);
          return { kind: "ok", uid, prev, next };
        });
      } catch (e) {
        return mapError<NfcReadWriteResult>(
          e,
          (msg) => ({ kind: "error", uid: null, error: msg }),
          { kind: "canceled" },
        );
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  const initializeBracelet = useCallback(async (): Promise<NfcInitResult> => {
    if (!NFC_AVAILABLE) {
      return {
        kind: "error",
        uid: null,
        error: "NFC is not available on this device",
      };
    }
    setError(null);
    setIsBusy(true);
    try {
      return await withSession<NfcInitResult>(async (s) => {
        const uid = await s.readUid();
        const bytes = await s.readPages(CHIP_USER_PAGE, READ_BYTES / 4);
        const blob = bytes.subarray(0, CHIP_BLOB_SIZE);
        try {
          const chipState = decodeChipBlob(blob, uid);
          return { kind: "already-initialized", uid, chipState };
        } catch (e) {
          if (!(e instanceof ChipBlobError)) throw e;
        }
        const initial: ChipState = {
          balance: 0,
          debitCounter: 0,
          creditCounterSeen: 0,
        };
        const newBlob = encodeChipBlob(initial, uid);
        await s.writePages(CHIP_USER_PAGE, newBlob);
        return { kind: "ok", uid };
      });
    } catch (e) {
      return mapError<NfcInitResult>(
        e,
        (msg) => ({ kind: "error", uid: null, error: msg }),
        { kind: "canceled" },
      );
    } finally {
      setIsBusy(false);
    }
  }, []);

  const resetBracelet = useCallback(async (): Promise<NfcInitResult> => {
    if (!NFC_AVAILABLE) {
      return {
        kind: "error",
        uid: null,
        error: "NFC is not available on this device",
      };
    }
    setError(null);
    setIsBusy(true);
    try {
      return await withSession<NfcInitResult>(async (s) => {
        const uid = await s.readUid();
        const initial: ChipState = {
          balance: 0,
          debitCounter: 0,
          creditCounterSeen: 0,
        };
        const newBlob = encodeChipBlob(initial, uid);
        await s.writePages(CHIP_USER_PAGE, newBlob);
        return { kind: "ok", uid };
      });
    } catch (e) {
      return mapError<NfcInitResult>(
        e,
        (msg) => ({ kind: "error", uid: null, error: msg }),
        { kind: "canceled" },
      );
    } finally {
      setIsBusy(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    await cancelActiveSession();
    setIsBusy(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isAvailable: NFC_AVAILABLE,
    isBusy,
    error,
    clearError,
    cancel,
    readUid,
    readBracelet,
    writeChipState,
    readWriteBracelet,
    initializeBracelet,
    resetBracelet,
  };
}

function mapError<T>(
  e: unknown,
  toError: (msg: string) => T,
  canceled: T,
): T {
  const msg = extractErrorMessage(e);
  if (msg && /cancel/i.test(msg)) return canceled;
  return toError(msg);
}
