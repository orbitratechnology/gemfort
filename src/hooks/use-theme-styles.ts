import { useMemo } from 'react';
import { type TextStyle, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

/** Shared dynamic styles for screens migrating off static Palette grays */
export function useThemeStyles() {
  const { colors } = useAppTheme();

  return useMemo(
    () => ({
      colors,
      screen: { flex: 1, backgroundColor: colors.background } satisfies ViewStyle,
      surface: { backgroundColor: colors.surface } satisfies ViewStyle,
      surfaceMuted: { backgroundColor: colors.surfaceMuted } satisfies ViewStyle,
      text: { color: colors.text } satisfies TextStyle,
      textSecondary: { color: colors.textSecondary } satisfies TextStyle,
      textMuted: { color: colors.textMuted } satisfies TextStyle,
      textPrimary: { color: colors.primary } satisfies TextStyle,
      textAccent: { color: colors.accent } satisfies TextStyle,
      border: { borderColor: colors.border } satisfies ViewStyle,
      input: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        color: colors.text,
      } satisfies ViewStyle & TextStyle,
      chip: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      } satisfies ViewStyle,
      chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      } satisfies ViewStyle,
      chipText: { color: colors.textSecondary } satisfies TextStyle,
      chipTextActive: { color: colors.textInverse } satisfies TextStyle,
      sectionTitle: { color: colors.text } satisfies TextStyle,
      placeholder: { backgroundColor: colors.skeleton } satisfies ViewStyle,
    }),
    [colors],
  );
}

export function useThemedScreenStyle() {
  const { screen } = useThemeStyles();
  return screen;
}
