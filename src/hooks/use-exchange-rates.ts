import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  clearExchangeRateCache,
  fetchExchangeRatesSnapshot,
  type ExchangeRatesSnapshot,
} from '@/lib/exchange-rates';

export const EXCHANGE_RATES_QUERY_KEY = ['exchange-rates'] as const;

export function useExchangeRates() {
  return useQuery<ExchangeRatesSnapshot>({
    queryKey: EXCHANGE_RATES_QUERY_KEY,
    queryFn: fetchExchangeRatesSnapshot,
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
    retry: 2,
  });
}

export function useInvalidateExchangeRates() {
  const client = useQueryClient();
  return async () => {
    clearExchangeRateCache();
    await client.invalidateQueries({ queryKey: EXCHANGE_RATES_QUERY_KEY });
  };
}
