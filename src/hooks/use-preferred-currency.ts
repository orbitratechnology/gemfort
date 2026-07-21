import {
  BASE_CURRENCY,
  resolveCurrencyCode,
  type CurrencyCode,
} from '@/constants/currencies';
import { useAuth } from '@/providers/auth-provider';

/** Signed-in user's preferred display/entry currency (falls back to LKR). */
export function usePreferredCurrency(): CurrencyCode {
  const { profile } = useAuth();
  return resolveCurrencyCode(profile?.preferredCurrency, BASE_CURRENCY);
}
