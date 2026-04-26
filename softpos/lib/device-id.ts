import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'softpos.device-id';

let cached: string | null | undefined = undefined;

// Stable per-install identifier used as `deviceId` on charge requests.
// Does not represent a backend-registered device row yet, so charges
// will fail server-side until proper device registration is wired up.
// See follow-up: vendor device provisioning.
export function getOrCreateLocalDeviceId(): string {
  if (cached !== undefined && cached !== null) return cached;
  const existing = SecureStore.getItem(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  cached = next;
  void SecureStore.setItemAsync(DEVICE_ID_KEY, next);
  return next;
}
