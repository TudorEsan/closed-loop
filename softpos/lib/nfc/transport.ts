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

let sessionChain: Promise<unknown> = Promise.resolve();

export type WithSessionOptions = {
  /** Reject requestTechnology after this many ms if no chip enters the field. */
  acquireTimeoutMs?: number;
};

export async function withSession<T>(
  work: (session: NfcSession) => Promise<T>,
  opts: WithSessionOptions = {},
): Promise<T> {
  const run = sessionChain.then(() => runSession(work, opts));
  sessionChain = run.catch(() => undefined);
  return run;
}

let sessionSeq = 0;

async function runSession<T>(
  work: (session: NfcSession) => Promise<T>,
  opts: WithSessionOptions,
): Promise<T> {
  if (!NfcManager || !NfcTech) {
    throw new Error("NFC is not available on this device");
  }

  const id = ++sessionSeq;
  console.log(`[nfc] session#${id} requesting NfcA`);
  await NfcManager.start();
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // no active request, ignore
  }

  const acquireTimeoutMs = opts.acquireTimeoutMs ?? 20000;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    NfcManager?.cancelTechnologyRequest().catch(() => undefined);
  }, acquireTimeoutMs);
  try {
    await NfcManager.requestTechnology(NfcTech.NfcA);
  } catch (e) {
    clearTimeout(timer);
    if (timedOut) {
      console.log(`[nfc] session#${id} acquire timed out after ${acquireTimeoutMs}ms`);
      throw new Error("Tag not detected. Tap the bracelet to the phone.");
    }
    throw e;
  }
  clearTimeout(timer);
  console.log(`[nfc] session#${id} acquired`);

  const session: NfcSession = {
    async readUid() {
      const tag = await NfcManager!.getTag();
      const uid = tag?.id ?? null;
      console.log(`[nfc] session#${id} readUid -> ${uid}`);
      if (!uid) throw new Error("Could not read tag UID");
      return uid;
    },
    async readPages(startPage, count) {
      console.log(
        `[nfc] session#${id} readPages start=${startPage} count=${count}`,
      );
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
      console.log(`[nfc] session#${id} readPages done bytes=${written}`);
      return out;
    },
    async writePages(startPage, bytes) {
      console.log(
        `[nfc] session#${id} writePages start=${startPage} bytes=${bytes.length}`,
      );
      if (bytes.length % PAGE_SIZE !== 0) {
        throw new Error(
          `writePages: byte length ${bytes.length} not aligned to ${PAGE_SIZE}`,
        );
      }
      for (let i = 0; i < bytes.length; i += PAGE_SIZE) {
        const page = startPage + i / PAGE_SIZE;
        try {
          await transceive([
            NTAG_WRITE_CMD,
            page,
            bytes[i],
            bytes[i + 1],
            bytes[i + 2],
            bytes[i + 3],
          ]);
        } catch (e) {
          console.log(
            `[nfc] session#${id} writePages FAIL page=${page} error=${(e as Error)?.message}`,
          );
          throw e;
        }
      }
      console.log(`[nfc] session#${id} writePages done`);
    },
  };

  try {
    return await work(session);
  } catch (e) {
    console.log(
      `[nfc] session#${id} work threw: ${(e as Error)?.message ?? String(e)}`,
    );
    throw e;
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log(`[nfc] session#${id} released`);
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
  const cmdHex = command
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  try {
    const result: number[] = await handler.transceive(command);
    return Uint8Array.from(result);
  } catch (e) {
    console.log(
      `[nfc] transceive FAIL cmd=[${cmdHex}] error=${(e as Error)?.message ?? String(e)}`,
    );
    throw e;
  }
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
