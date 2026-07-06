/** GemFort design tokens — semantic light/dark theme (M3 Minimal Interface) */

import { Platform } from 'react-native';

/** Core brand colors (constant across themes) */
export const Palette = {
  primary: '#00162c',
  onPrimary: '#ffffff',
  primaryContainer: '#122b44',
  onPrimaryContainer: '#7b93b1',
  secondary: '#755b00',
  onSecondary: '#ffffff',
  secondaryContainer: '#fed977',
  onSecondaryContainer: '#785d00',
  tertiary: '#211200',
  onTertiary: '#ffffff',
  tertiaryContainer: '#3c2501',
  onTertiaryContainer: '#ae8b5c',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  background: '#f8f9fa',
  onBackground: '#191c1d',
  surface: '#f8f9fa',
  onSurface: '#191c1d',
  surfaceVariant: '#e1e3e4',
  onSurfaceVariant: '#43474d',
  outline: '#74777e',
  outlineVariant: '#c4c6ce',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f4f5',
  surfaceContainer: '#edeeef',
  surfaceContainerHigh: '#e7e8e9',
  surfaceContainerHighest: '#e1e3e4',
  surfaceGlass: 'rgba(255, 255, 255, 0.7)',
  textMain: '#1A1C1E',
  textMuted: '#64748B',
  successEmerald: '#2D6A4F',
  warningAmber: '#D97706',
  
  // Keep legacy colors for backward compatibility during migration
  gemBlue: '#163A52',
  gemBlueDark: '#0D2234',
  gemGold: '#B8922E',
  gemGoldSoft: '#E8D5A8',
  facetTeal: '#1F6B7A',
  white: '#FFFFFF',
  verifiedGreen: '#2A7A4B',
  basicBlue: '#2563A8',
  pendingAmber: '#A66B12',
  revokedRed: '#B83A3A',
  success: '#2A7A4B',
  warning: '#A66B12',
  info: '#2563A8',
  whatsapp: '#25D366',
  phone: '#2563A8',
  gray900: '#141A22',
  gray700: '#4A5568',
  gray500: '#718096',
  gray300: '#D8DEE6',
  gray100: '#EEF1F5',
  gray50: '#F5F7FA',
  alertCriticalBg: '#FDECEC',
  alertWarningBg: '#FDF6E3',
  alertInfoBg: '#E8F2FA',
} as const;

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  accentSoft: string;
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
  tabBar: string;
  tabBarBorder: string;
  header: string;
  cardShadow: string;
  alertCriticalBg: string;
  alertWarningBg: string;
  alertInfoBg: string;
  
  // New M3 tokens
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceGlass: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  tertiaryFixed: string;
  primaryFixed: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  outline: string;
  outlineVariant: string;
  successEmerald: string;
  warningAmber: string;
  textMain: string;
  white: string;
};

const lightTheme: ThemeColors = {
  background: Palette.background,
  backgroundElevated: Palette.surfaceContainerLowest,
  surface: Palette.surfaceContainerLowest,
  surfaceMuted: Palette.surfaceContainerLow,
  border: Palette.outlineVariant,
  borderSubtle: Palette.surfaceVariant,
  text: Palette.textMain,
  textSecondary: Palette.onSurfaceVariant,
  textMuted: Palette.textMuted,
  textInverse: Palette.onPrimary,
  primary: Palette.primary,
  primaryMuted: Palette.primaryContainer,
  accent: Palette.secondary,
  accentSoft: Palette.secondaryContainer,
  overlay: 'rgba(0, 22, 44, 0.05)',
  skeleton: Palette.surfaceContainerHigh,
  skeletonHighlight: Palette.surfaceContainerHighest,
  tabBar: Palette.surfaceContainerLowest,
  tabBarBorder: Palette.surfaceVariant,
  header: Palette.surfaceContainerLowest,
  cardShadow: 'rgba(0, 22, 44, 0.05)',
  alertCriticalBg: Palette.errorContainer,
  alertWarningBg: '#fef3c7',
  alertInfoBg: '#e0f2fe',
  
  surfaceContainerLowest: Palette.surfaceContainerLowest,
  surfaceContainerLow: Palette.surfaceContainerLow,
  surfaceContainer: Palette.surfaceContainer,
  surfaceContainerHigh: Palette.surfaceContainerHigh,
  surfaceContainerHighest: Palette.surfaceContainerHighest,
  surfaceGlass: Palette.surfaceGlass,
  surfaceVariant: Palette.surfaceVariant,
  onSurface: Palette.onSurface,
  onSurfaceVariant: Palette.onSurfaceVariant,
  onPrimary: Palette.onPrimary,
  primaryContainer: Palette.primaryContainer,
  onPrimaryContainer: Palette.onPrimaryContainer,
  secondary: Palette.secondary,
  onSecondary: Palette.onSecondary,
  secondaryContainer: Palette.secondaryContainer,
  onSecondaryContainer: Palette.onSecondaryContainer,
  tertiary: Palette.tertiary,
  onTertiary: Palette.onTertiary,
  tertiaryContainer: Palette.tertiaryContainer,
  onTertiaryContainer: Palette.onTertiaryContainer,
  tertiaryFixed: '#ffddb4',
  primaryFixed: '#d1e4ff',
  error: Palette.error,
  onError: Palette.onError,
  errorContainer: Palette.errorContainer,
  onErrorContainer: Palette.onErrorContainer,
  outline: Palette.outline,
  outlineVariant: Palette.outlineVariant,
  successEmerald: Palette.successEmerald,
  warningAmber: Palette.warningAmber,
  textMain: Palette.textMain,
  white: Palette.white,
};

// Generate a dark theme based on the light theme structure (since design.html doesn't explicitly define dark mode colors)
const darkTheme: ThemeColors = {
  background: '#111315',
  backgroundElevated: '#191c1e',
  surface: '#191c1e',
  surfaceMuted: '#1d2022',
  border: '#3a3e43',
  borderSubtle: '#26292c',
  text: '#e1e3e4',
  textSecondary: '#c4c6ce',
  textMuted: '#8d9199',
  textInverse: '#00162c',
  primary: '#b1c8e8',
  primaryMuted: '#122b44',
  accent: '#fed977',
  accentSoft: '#584400',
  overlay: 'rgba(255, 255, 255, 0.05)',
  skeleton: '#2e3132',
  skeletonHighlight: '#43474d',
  tabBar: '#1a1c1e',
  tabBarBorder: '#2e3132',
  header: '#1a1c1e',
  cardShadow: 'rgba(0, 0, 0, 0.35)',
  alertCriticalBg: '#93000a',
  alertWarningBg: '#785d00',
  alertInfoBg: '#122b44',
  
  surfaceContainerLowest: '#191c1e',
  surfaceContainerLow: '#1d2022',
  surfaceContainer: '#212426',
  surfaceContainerHigh: '#282b2e',
  surfaceContainerHighest: '#31353a',
  surfaceGlass: 'rgba(25, 28, 30, 0.72)',
  surfaceVariant: '#3a3e43',
  onSurface: '#e1e3e4',
  onSurfaceVariant: '#c4c6ce',
  onPrimary: '#00162c',
  primaryContainer: '#122b44',
  onPrimaryContainer: '#d1e4ff',
  secondary: '#fed977',
  onSecondary: '#241a00',
  secondaryContainer: '#584400',
  onSecondaryContainer: '#ffe08f',
  tertiary: '#ffddb4',
  onTertiary: '#291800',
  tertiaryContainer: '#5d421a',
  onTertiaryContainer: '#e8c08d',
  tertiaryFixed: '#5d421a',
  primaryFixed: '#122b44',
  error: '#ffdad6',
  onError: '#410002',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  outline: '#8d9199',
  outlineVariant: '#3a3e43',
  successEmerald: '#5FD68F',
  warningAmber: '#F0A93B',
  textMain: '#e1e3e4',
  white: '#FFFFFF',
};

export function getThemeColors(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export const Typography = {
  displayLg: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.64 },
  headlineMd: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.24 },
  headlineSm: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  headlineSmMobile: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  headlineMdMobile: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  labelMd: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
  
  // Keep legacy typography for backward compatibility during migration
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.2 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '500' as const },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.2 },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  story: { fontSize: 28, lineHeight: 34, fontWeight: '600' as const, letterSpacing: -0.4 },
};

export const FontFamily = Platform.select({
  ios: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  android: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    semibold: 'sans-serif-medium',
    bold: 'sans-serif',
  },
  default: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
})!;

export const Spacing = {
  stackSm: 8,
  stackMd: 12,
  gutterMd: 16,
  containerMargin: 20,
  sectionGap: 32,
  
  // Keep legacy spacing for backward compatibility
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
  screen: 48,
} as const;

export const Radius = {
  sm: 4, // 0.25rem
  md: 8, // 0.5rem
  lg: 12, // 0.75rem
  xl: 16, // Assuming xl is larger
  full: 9999,
} as const;

export const TouchTarget = {
  minHeight: 48,
  minWidth: 44,
} as const;

export const Motion = {
  fast: 120,
  normal: 220,
  slow: 360,
  spring: { damping: 18, stiffness: 180 },
} as const;
