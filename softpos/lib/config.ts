import Constants from 'expo-constants';
import { Platform } from 'react-native';

// On Android emulator, localhost is the emulator itself, so the dev machine
// is reachable as 10.0.2.2. On iOS simulator localhost works as is.
// For physical devices we use the LAN IP from expo (debuggerHost).
function resolveDevHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest
      ?.debuggerHost ??
    '';
  const host = hostUri.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return host;
  }
  if (Platform.OS === 'android') return '10.0.2.2';
  return 'localhost';
}

const host = resolveDevHost();

export const config = {
  apiBaseUrl: `http://${host}:3000/api/v1`,
  authBaseUrl: `http://${host}:3000`,
};
