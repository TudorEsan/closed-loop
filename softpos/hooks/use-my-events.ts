import { useQuery } from '@tanstack/react-query';

import { braceletsApi } from '@/lib/api/bracelets';
import { useAuthContext } from '@/lib/auth-context';

export const MY_EVENTS_QUERY_KEY = ['my-events'] as const;

export function useMyEvents() {
  const { session } = useAuthContext();
  return useQuery({
    queryKey: MY_EVENTS_QUERY_KEY,
    queryFn: () => braceletsApi.myEvents(),
    enabled: !!session,
    retry: false,
  });
}
