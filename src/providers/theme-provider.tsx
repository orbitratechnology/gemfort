import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getThemeColors, type ColorScheme } from '@/constants/design-tokens';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme-preference';
import { ThemeContext } from '@/providers/theme-context';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getThemePreference().then(setPreferenceState);
  }, []);

  const scheme: ColorScheme =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  const setPreference = useCallback(async (next: ThemePreference) => {
    await setThemePreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({
      scheme,
      colors: getThemeColors(scheme),
      isDark: scheme === 'dark',
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={value.isDark ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}
