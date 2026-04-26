import { Directory, File, Paths } from "expo-file-system";

import type { LocalDebit, QueueScope } from "./types";

// One JSON file per (eventId, vendorId) under the app document directory.
// expo-file-system's File API is used directly; no SecureStore size limits
// to dance around since this data is not sensitive (the wire payload is
// also accepted by the server unauthenticated of HMAC).

const ROOT_DIRNAME = "softpos-offline-queue";

function rootDir(): Directory {
  const dir = new Directory(Paths.document, ROOT_DIRNAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function queueFile(scope: QueueScope): File {
  const safeEvent = sanitize(scope.eventId);
  const safeVendor = sanitize(scope.vendorId);
  return new File(rootDir(), `queue-${safeEvent}-${safeVendor}.json`);
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, "_");
}

export async function listDebits(scope: QueueScope): Promise<LocalDebit[]> {
  const file = queueFile(scope);
  if (!file.exists) return [];
  const raw = await file.text();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { debits?: LocalDebit[] } | LocalDebit[];
    if (Array.isArray(parsed)) return parsed;
    return parsed.debits ?? [];
  } catch {
    return [];
  }
}

async function writeAll(
  scope: QueueScope,
  debits: LocalDebit[],
): Promise<void> {
  const file = queueFile(scope);
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify({ debits }));
}

export async function appendDebit(
  scope: QueueScope,
  debit: LocalDebit,
): Promise<void> {
  const current = await listDebits(scope);
  current.push(debit);
  await writeAll(scope, current);
}

export async function countPending(scope: QueueScope): Promise<number> {
  const debits = await listDebits(scope);
  return debits.filter((d) => d.status === "pending").length;
}

export async function applyServerOutcome(
  scope: QueueScope,
  applied: string[],
  rejected: { idempotencyKey: string; reason: LocalDebit["rejectionReason"] }[],
): Promise<LocalDebit[]> {
  const all = await listDebits(scope);
  const appliedSet = new Set(applied);
  const rejectedMap = new Map(
    rejected.map((r) => [r.idempotencyKey, r.reason] as const),
  );

  const next: LocalDebit[] = [];
  for (const debit of all) {
    const key = debit.wire.idempotencyKey;
    if (appliedSet.has(key)) continue;
    const rejection = rejectedMap.get(key);
    if (rejection === "duplicate") continue;
    if (rejection) {
      next.push({
        ...debit,
        status: "rejected",
        rejectionReason: rejection,
      });
    } else {
      next.push(debit);
    }
  }
  await writeAll(scope, next);
  return next;
}

export async function clear(scope: QueueScope): Promise<void> {
  const file = queueFile(scope);
  if (file.exists) file.delete();
}

export async function removeRejected(scope: QueueScope): Promise<void> {
  const all = await listDebits(scope);
  await writeAll(
    scope,
    all.filter((d) => d.status !== "rejected"),
  );
}
