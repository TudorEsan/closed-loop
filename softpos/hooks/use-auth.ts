import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi, type AuthSession, type AuthUser } from '@/lib/auth';

export const AUTH_SESSION_QUERY_KEY = ['auth', 'session'] as const;

export type UseAuthValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  role: AuthUser['role'] | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: AuthSession | null) => void;
};

export function useAuth(): UseAuthValue {
  const queryClient = useQueryClient();

  const { data: session = null, isPending } = useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async () => (await authApi.getSession()) ?? null,
    staleTime: Infinity,
    retry: false,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
  }, [queryClient]);

  const setSession = useCallback(
    (next: AuthSession | null) => {
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, next);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    setSession(null);
    // Wipe every cached query so the next user does not see the previous
    // user's memberships, bracelets, transactions, etc. The auth-session
    // entry was just reset above; clearing afterwards is fine because
    // queries refetch on next mount.
    queryClient.removeQueries();
  }, [queryClient, setSession]);

  return {
    session,
    user: session?.user ?? null,
    role: session?.user?.role ?? null,
    isLoading: isPending,
    refresh,
    signOut,
    setSession,
  };
}
