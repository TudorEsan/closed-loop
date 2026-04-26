import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { braceletsApi } from '@/lib/api/bracelets';
import { useAuthContext } from '@/lib/auth-context';

export const RECENT_TRANSACTIONS_QUERY_KEY = ['transactions'] as const;
export const FULL_TRANSACTIONS_QUERY_KEY = ['transactions-full'] as const;

export function useRecentTransactions(limit = 10) {
  const { session } = useAuthContext();
  return useQuery({
    queryKey: RECENT_TRANSACTIONS_QUERY_KEY,
    queryFn: () => braceletsApi.myTransactions({ limit }),
    enabled: !!session,
    retry: false,
  });
}

export function useTransactionsInfinite(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: FULL_TRANSACTIONS_QUERY_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      braceletsApi.myTransactions({
        limit: pageSize,
        cursor: pageParam,
      }),
    getNextPageParam: (last) =>
      (last.nextCursor ?? undefined) as string | undefined,
  });
}
