import * as SecureStore from 'expo-secure-store';

import type { ColorScheme } from '@/constants/design-tokens';

const KEY = 'gemfort_theme_preference';

export type ThemePreference = 'system' | ColorScheme;

export async function getThemePreference(): Promise<ThemePreference> {
  const value = await SecureStore.getItemAsync(KEY);
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  await SecureStore.setItemAsync(KEY, preference);
}

export async function clearThemePreference(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
