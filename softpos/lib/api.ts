import axios, { AxiosError } from 'axios';

import { config } from './config';
import { getStoredToken, setStoredToken } from './auth';
import { queryClient } from './query';
import { AUTH_SESSION_QUERY_KEY } from '@/hooks/use-auth';

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

// Guard so we only clear the session once per stale token even if a
// bunch of queries 401 at the same time.
let isClearingSession = false;

// A 401 from a non-auth route means the bearer token the phone has is
// not accepted. Clear local state and let the auth context drive the
// redirect to /login through Index/TabsLayout. We deliberately do NOT
// call authClient.signOut() here, that would destroy the server-side
// session and turn a transient hiccup into a hard sign-out.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    const isAuthRoute = url.includes('/api/auth');

    if (status === 401 && !isAuthRoute && !isClearingSession) {
      isClearingSession = true;
      try {
        await setStoredToken(null);
        queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, null);
      } finally {
        setTimeout(() => {
          isClearingSession = false;
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
