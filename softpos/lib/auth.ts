import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

import { config } from './config';

// better-auth client wired up for Expo. The expoClient plugin handles cookie
// persistence in SecureStore for us, so we do not need to manage Set-Cookie
// headers by hand. Other API calls can grab the cookie via authClient.getCookie()
// and forward it as a header.
export const authClient = createAuthClient({
  baseURL: config.authBaseUrl,
  plugins: [
    expoClient({
      scheme: 'softpos',
      storagePrefix: 'softpos',
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
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
    const { data } = await authClient.getSession();
    if (!data?.user) return null;
    return { user: data.user as AuthUser };
  },

  async signOut(): Promise<void> {
    try {
      await authClient.signOut();
    } catch {
      // ignore, plugin clears local state anyway
    }
  },
};
