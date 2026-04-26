import { useQuery } from '@tanstack/react-query';

import { braceletsApi } from '@/lib/api/bracelets';
import { useAuthContext } from '@/lib/auth-context';

export const MY_BRACELETS_QUERY_KEY = ['my-bracelets'] as const;

export function useMyBracelets() {
  const { session } = useAuthContext();
  return useQuery({
    queryKey: MY_BRACELETS_QUERY_KEY,
    queryFn: () => braceletsApi.myBracelets(),
    enabled: !!session,
    retry: false,
  });
}
