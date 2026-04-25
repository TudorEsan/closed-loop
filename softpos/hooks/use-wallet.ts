import { useQuery } from '@tanstack/react-query';

import { walletsApi } from '@/lib/api/wallets';
import { useAuthContext } from '@/lib/auth-context';

export const WALLET_QUERY_KEY = ['wallet'] as const;

export function useWallet() {
  const { session } = useAuthContext();
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: () => walletsApi.getMyWallet(),
    enabled: !!session,
    retry: false,
  });
}
