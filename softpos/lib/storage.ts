import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'softpos.session';
const COOKIE_KEY = 'softpos.cookie';

export const sessionStore = {
  async getCookie(): Promise<string | null> {
    return SecureStore.getItemAsync(COOKIE_KEY);
  },
  async setCookie(value: string): Promise<void> {
    await SecureStore.setItemAsync(COOKIE_KEY, value);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(COOKIE_KEY);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
  async getSelectedEvent(): Promise<string | null> {
    return SecureStore.getItemAsync('softpos.eventId');
  },
  async setSelectedEvent(eventId: string): Promise<void> {
    await SecureStore.setItemAsync('softpos.eventId', eventId);
  },
  async getSelectedVendor(): Promise<string | null> {
    return SecureStore.getItemAsync('softpos.vendorId');
  },
  async setSelectedVendor(vendorId: string): Promise<void> {
    await SecureStore.setItemAsync('softpos.vendorId', vendorId);
  },
  async clearVendorContext(): Promise<void> {
    await SecureStore.deleteItemAsync('softpos.vendorId');
    await SecureStore.deleteItemAsync('softpos.eventId');
  },
};
