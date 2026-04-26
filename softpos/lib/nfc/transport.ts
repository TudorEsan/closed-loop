// Thin wrapper over react-native-nfc-manager. The manager has its own
// session lifecycle that callers tend to leak; withSession centralizes
// start / requestTechnology / cancelTechnologyRequest so consumers do not
// have to.

let NfcManager: typeof import("react-native-nfc-manager").default | null = null;
let NfcTech: typeof import("react-native-nfc-manager").NfcTech | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("react-native-nfc-manager");
  NfcManager = mod.default;
  NfcTech = mod.NfcTech;
} catch {
  NfcManager = null;
}

export const NFC_AVAILABLE = !!(NfcManager && NfcTech);

export type NfcSession = {
  readUid(): Promise<string>;
  readPages(startPage: number, count: number): Promise<Uint8Array>;
  writePages(startPage: number, bytes: Uint8Array): Promise<void>;
};

const NTAG_READ_CMD = 0x30;
const NTAG_WRITE_CMD = 0xa2;
const READ_PAGE_COUNT = 4; // NTAG READ returns 4 pages = 16 bytes
const PAGE_SIZE = 4;

export async function withSession<T>(
  work: (session: NfcSession) => Promise<T>,
): Promise<T> {
  if (!NfcManager || !NfcTech) {
    throw new Error("NFC is not available on this device");
  }

  await NfcManager.start();
  await NfcManager.requestTechnology(NfcTech.NfcA);

  const session: NfcSession = {
    async readUid() {
      const tag = await NfcManager!.getTag();
      const uid = tag?.id ?? null;
      if (!uid) throw new Error("Could not read tag UID");
      return uid;
    },
    async readPages(startPage, count) {
      const out = new Uint8Array(count * PAGE_SIZE);
      let written = 0;
      let page = startPage;
      while (written < out.length) {
        const chunk = await transceive([NTAG_READ_CMD, page]);
        const remaining = out.length - written;
        const take = Math.min(chunk.length, remaining);
        out.set(chunk.subarray(0, take), written);
        written += take;
        page += READ_PAGE_COUNT;
      }
      return out;
    },
    async writePages(startPage, bytes) {
      if (bytes.length % PAGE_SIZE !== 0) {
        throw new Error(
          `writePages: byte length ${bytes.length} not aligned to ${PAGE_SIZE}`,
        );
      }
      for (let i = 0; i < bytes.length; i += PAGE_SIZE) {
        const page = startPage + i / PAGE_SIZE;
        await transceive([
          NTAG_WRITE_CMD,
          page,
          bytes[i],
          bytes[i + 1],
          bytes[i + 2],
          bytes[i + 3],
        ]);
      }
    },
  };

  try {
    return await work(session);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // ignore - session may already be torn down
    }
  }
}

export async function cancelActiveSession(): Promise<void> {
  if (!NfcManager) return;
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // ignore
  }
}

async function transceive(command: number[]): Promise<Uint8Array> {
  const handler = getNfcAHandler();
  const result: number[] = await handler.transceive(command);
  return Uint8Array.from(result);
}

function getNfcAHandler(): { transceive(command: number[]): Promise<number[]> } {
  if (!NfcManager) throw new Error("NFC is not available");
  // The manager exposes platform-specific handlers; nfcAHandler covers
  // both iOS and Android for raw NfcA commands.
  const handler = (NfcManager as unknown as {
    nfcAHandler?: { transceive(cmd: number[]): Promise<number[]> };
    transceive?: (cmd: number[]) => Promise<number[]>;
  }).nfcAHandler;
  if (handler?.transceive) return handler;
  // Fallback to direct manager.transceive on older versions.
  const direct = (NfcManager as unknown as {
    transceive?: (cmd: number[]) => Promise<number[]>;
  }).transceive;
  if (direct) return { transceive: direct.bind(NfcManager) };
  throw new Error("NFC transceive is not supported by this manager build");
}
