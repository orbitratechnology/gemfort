import { useContext } from 'react';

import { getThemeColors, type ColorScheme, type ThemeColors } from '@/constants/design-tokens';
import type { ThemePreference } from '@/lib/theme-preference';
import { ThemeContext } from '@/providers/theme-provider';

export function useAppTheme(): {
  scheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
} {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    scheme: 'light',
    colors: getThemeColors('light'),
    isDark: false,
    preference: 'system',
    setPreference: async () => {},
  };
}
