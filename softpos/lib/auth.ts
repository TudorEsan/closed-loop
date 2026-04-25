import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

import { config } from './config';

const TOKEN_KEY = 'softpos.bearer-token';

// React Native has no cookie jar, so we use bearer tokens instead of
// session cookies. The backend's bearer() plugin returns the token in
// the `set-auth-token` response header on sign-in, and accepts it on
// subsequent requests via the standard Authorization header.
export function getStoredToken(): string | null {
  return SecureStore.getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export const authClient = createAuthClient({
  baseURL: config.authBaseUrl,
  plugins: [emailOTPClient()],
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: () => getStoredToken() ?? '',
    },
    headers: {
      // React Native fetch does not set Origin, but better-auth checks it
      // against trustedOrigins. Send our app scheme so the server can match.
      Origin: 'softpos://',
    },
    onSuccess: async (ctx) => {
      const token = ctx.response.headers.get('set-auth-token');
      if (token) {
        await setStoredToken(token);
      }
    },
  },
});

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  phone?: string | null;
};

export type AuthSession = {
  user: AuthUser;
};

export const authApi = {
  async sendOtp(email: string): Promise<void> {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    });
    if (error) {
      throw new Error(error.message ?? 'Could not send the code');
    }
  },

  async verifyOtp(email: string, otp: string): Promise<AuthSession> {
    const { data, error } = await authClient.signIn.emailOtp({ email, otp });
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not verify the code');
    }
    return { user: data.user as AuthUser };
  },

  async getSession(): Promise<AuthSession | null> {
    if (!getStoredToken()) return null;
    const { data } = await authClient.getSession();
    if (!data?.user) return null;
    return { user: data.user as AuthUser };
  },

  async signOut(): Promise<void> {
    try {
      await authClient.signOut();
    } catch {
      // ignore network failures, we still clear the local token below
    } finally {
      await setStoredToken(null);
    }
  },
};
