import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingDebit = {
  idempotencyKey: string;
  amount: number;
  vendorId: string;
  eventId: string;
  wristbandUid: string;
  counterValue: number;
  deviceId: string;
  clientTimestamp: string;
};

const QUEUE_KEY = 'softpos.offlineQueue.v1';

async function readAll(): Promise<PendingDebit[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingDebit[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: PendingDebit[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueue(debit: PendingDebit): Promise<void> {
  const items = await readAll();
  items.push(debit);
  await writeAll(items);
}

export async function peekAll(): Promise<PendingDebit[]> {
  return readAll();
}

export async function markApplied(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const set = new Set(keys);
  const items = await readAll();
  await writeAll(items.filter((d) => !set.has(d.idempotencyKey)));
}

export async function clear(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function groupByWristband(): Promise<
  { eventId: string; wristbandUid: string; debits: PendingDebit[] }[]
> {
  const items = await readAll();
  const groups = new Map<string, PendingDebit[]>();
  for (const item of items) {
    const key = `${item.eventId}::${item.wristbandUid}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([key, debits]) => {
    const [eventId, wristbandUid] = key.split('::');
    return { eventId, wristbandUid, debits };
  });
}
