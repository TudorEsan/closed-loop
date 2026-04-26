import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: 'https://oyster-app-wpqlj.ondigitalocean.appπ',
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: 'include',
  },
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  emailOtp,
} = authClient;
