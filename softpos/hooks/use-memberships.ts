import { useQuery } from '@tanstack/react-query';

import { meApi } from '@/lib/api/me';
import { useAuthContext } from '@/lib/auth-context';

export const MEMBERSHIPS_QUERY_KEY = ['me', 'memberships'] as const;

export function useMyMemberships() {
  const { session } = useAuthContext();
  return useQuery({
    queryKey: MEMBERSHIPS_QUERY_KEY,
    queryFn: () => meApi.getMemberships(),
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
