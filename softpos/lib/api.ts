import axios, { AxiosError } from 'axios';
import { config } from './config';
import { authClient } from './auth';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// On RN we don't have a cookie jar so we forward the better-auth session
// cookie manually. The expo plugin gives us a helper for this.
api.interceptors.request.use((cfg) => {
  const cookie = authClient.getCookie();
  if (cookie) {
    cfg.headers.set?.('Cookie', cookie);
    cfg.headers.Cookie = cookie;
  }
  return cfg;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
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
