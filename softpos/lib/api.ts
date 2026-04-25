import axios, { AxiosError } from 'axios';
import { router } from 'expo-router';

import { config } from './config';
import { authClient, getStoredToken, setStoredToken } from './auth';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Forward the better-auth bearer token to API routes as well.
api.interceptors.request.use((cfg) => {
  const token = getStoredToken();
  if (token) {
    cfg.headers.set?.('Authorization', `Bearer ${token}`);
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Guard so we only kick the user out once per stale session even if a
// bunch of queries 401 at the same time.
let isSigningOut = false;

// Any 401 from a non-auth route means the session the phone thinks it
// has is dead on the backend side. Clear it and bounce back to login.
// Without this the app just sits on the home screen with a stale UI
// because nothing surfaces the failure.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    const isAuthRoute = url.includes('/api/auth');

    if (status === 401 && !isAuthRoute && !isSigningOut) {
      isSigningOut = true;
      try {
        await authClient.signOut();
      } catch {
        // ignore, we just want to clear local state
      }
      await setStoredToken(null);
      try {
        router.replace('/login');
      } finally {
        // release the guard on next tick so follow-up navigations work
        setTimeout(() => {
          isSigningOut = false;
        }, 500);
      }
    }

    return Promise.reject(error);
  },
);

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
