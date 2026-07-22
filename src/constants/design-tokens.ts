/** GemFort design tokens — semantic light/dark theme (M3 Minimal Interface) */

import { Platform } from "react-native";

/** Shared brand & semantic action colors — same in light and dark */
export const BrandPalette = {
  primary: "#171717",
  onPrimary: "#ffffff",
  primaryContainer: "#ebebeb",
  onPrimaryContainer: "#171717",
  primaryFixed: "#ebebeb",
  secondary: "#525252",
  onSecondary: "#ffffff",
  secondaryContainer: "#f2f2f2",
  onSecondaryContainer: "#171717",
  tertiary: "#262626",
  onTertiary: "#ffffff",
  tertiaryContainer: "#ebebeb",
  onTertiaryContainer: "#171717",
  tertiaryFixed: "#ebebeb",
  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
  successEmerald: "#15803d",
  warningAmber: "#D97706",
  gemBlue: "#404040",
  gemBlueDark: "#000000",
  gemGold: "#171717",
  gemGoldSoft: "#ebebeb",
  facetTeal: "#737373",
  white: "#FFFFFF",
  brandInk: "#000000",
  brandTeal: "#404040",
  verifiedGreen: "#2A7A4B",
  basicBlue: "#525252",
  pendingAmber: "#A66B12",
  revokedRed: "#B83A3A",
  success: "#2A7A4B",
  warning: "#A66B12",
  info: "#525252",
  whatsapp: "#25D366",
  phone: "#171717",
} as const;

/** Light mode — brand colors + light surfaces */
export const Palette = {
  ...BrandPalette,
  background: "#fafafa",
  onBackground: "#171717",
  surface: "#fafafa",
  onSurface: "#171717",
  surfaceVariant: "#e5e5e5",
  onSurfaceVariant: "#525252",
  outline: "#737373",
  outlineVariant: "#d4d4d4",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f5f5f5",
  surfaceContainer: "#f0f0f0",
  surfaceContainerHigh: "#ebebeb",
  surfaceContainerHighest: "#e5e5e5",
  surfaceGlass: "rgba(255, 255, 255, 0.7)",
  textMain: "#171717",
  textMuted: "#737373",
  gray900: "#171717",
  gray700: "#404040",
  gray500: "#737373",
  gray300: "#d4d4d4",
  gray100: "#f5f5f5",
  gray50: "#fafafa",
  alertCriticalBg: "#FDECEC",
  alertWarningBg: "#FDF6E3",
  alertInfoBg: "#f0f0f0",
} as const;

/** Dark mode — brand colors (lighter primaries) + dark surfaces */
export const PaletteDark = {
  ...BrandPalette,
  // Near-white primary for contrast on black/ash surfaces
  primary: "#f5f5f5",
  onPrimary: "#0a0a0a",
  primaryContainer: "#2a2a2a",
  onPrimaryContainer: "#f5f5f5",
  primaryFixed: "#d4d4d4",
  background: "#121212",
  onBackground: "#f5f5f5",
  surface: "#0a0a0a",
  onSurface: "#f5f5f5",
  surfaceVariant: "#2a2a2a",
  onSurfaceVariant: "#a3a3a3",
  outline: "#737373",
  outlineVariant: "#2a2a2a",
  surfaceContainerLowest: "#0a0a0a",
  surfaceContainerLow: "#141414",
  surfaceContainer: "#1a1a1a",
  surfaceContainerHigh: "#262626",
  surfaceContainerHighest: "#2a2a2a",
  surfaceGlass: "rgba(10, 10, 10, 0.72)",
  textMain: "#f5f5f5",
  textMuted: "#a3a3a3",
  backgroundElevated: "#0a0a0a",
  surfaceMuted: "#141414",
  overlay: "rgba(255, 255, 255, 0.05)",
  skeleton: "#2a2a2a",
  skeletonHighlight: "#404040",
  tabBar: "#0a0a0a",
  tabBarBorder: "#2a2a2a",
  header: "#0a0a0a",
  cardShadow: "rgba(0, 0, 0, 0.45)",
  alertCriticalBg: "#93000a",
  alertWarningBg: "#785d00",
  alertInfoBg: "#262626",
} as const;

export type ColorScheme = "light" | "dark";

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
  overlay: "rgba(0, 0, 0, 0.05)",
  skeleton: Palette.surfaceContainerHigh,
  skeletonHighlight: Palette.surfaceContainerHighest,
  tabBar: Palette.surfaceContainerLowest,
  tabBarBorder: Palette.surfaceVariant,
  header: Palette.surfaceContainerLowest,
  cardShadow: "rgba(0, 0, 0, 0.12)",
  alertCriticalBg: Palette.errorContainer,
  alertWarningBg: "#fef3c7",
  alertInfoBg: "#f0f0f0",

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
  tertiaryFixed: Palette.tertiaryFixed,
  primaryFixed: Palette.primaryFixed,
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

// Dark theme — mapped from PaletteDark (same structure as lightTheme)
const darkTheme: ThemeColors = {
  background: PaletteDark.background,
  backgroundElevated: PaletteDark.backgroundElevated,
  surface: PaletteDark.surface,
  surfaceMuted: PaletteDark.surfaceMuted,
  border: PaletteDark.outlineVariant,
  borderSubtle: PaletteDark.surfaceVariant,
  text: PaletteDark.textMain,
  textSecondary: PaletteDark.onSurfaceVariant,
  textMuted: PaletteDark.textMuted,
  textInverse: PaletteDark.onPrimary,
  primary: PaletteDark.primary,
  primaryMuted: PaletteDark.primaryContainer,
  accent: PaletteDark.secondary,
  accentSoft: PaletteDark.secondaryContainer,
  overlay: PaletteDark.overlay,
  skeleton: PaletteDark.skeleton,
  skeletonHighlight: PaletteDark.skeletonHighlight,
  tabBar: PaletteDark.tabBar,
  tabBarBorder: PaletteDark.tabBarBorder,
  header: PaletteDark.header,
  cardShadow: PaletteDark.cardShadow,
  alertCriticalBg: PaletteDark.alertCriticalBg,
  alertWarningBg: PaletteDark.alertWarningBg,
  alertInfoBg: PaletteDark.alertInfoBg,

  surfaceContainerLowest: PaletteDark.surfaceContainerLowest,
  surfaceContainerLow: PaletteDark.surfaceContainerLow,
  surfaceContainer: PaletteDark.surfaceContainer,
  surfaceContainerHigh: PaletteDark.surfaceContainerHigh,
  surfaceContainerHighest: PaletteDark.surfaceContainerHighest,
  surfaceGlass: PaletteDark.surfaceGlass,
  surfaceVariant: PaletteDark.surfaceVariant,
  onSurface: PaletteDark.onSurface,
  onSurfaceVariant: PaletteDark.onSurfaceVariant,
  onPrimary: PaletteDark.onPrimary,
  primaryContainer: PaletteDark.primaryContainer,
  onPrimaryContainer: PaletteDark.onPrimaryContainer,
  secondary: PaletteDark.secondary,
  onSecondary: PaletteDark.onSecondary,
  secondaryContainer: PaletteDark.secondaryContainer,
  onSecondaryContainer: PaletteDark.onSecondaryContainer,
  tertiary: PaletteDark.tertiary,
  onTertiary: PaletteDark.onTertiary,
  tertiaryContainer: PaletteDark.tertiaryContainer,
  onTertiaryContainer: PaletteDark.onTertiaryContainer,
  tertiaryFixed: PaletteDark.tertiaryFixed,
  primaryFixed: PaletteDark.primaryFixed,
  error: PaletteDark.error,
  onError: PaletteDark.onError,
  errorContainer: PaletteDark.errorContainer,
  onErrorContainer: PaletteDark.onErrorContainer,
  outline: PaletteDark.outline,
  outlineVariant: PaletteDark.outlineVariant,
  successEmerald: PaletteDark.successEmerald,
  warningAmber: PaletteDark.warningAmber,
  textMain: PaletteDark.textMain,
  white: PaletteDark.white,
};

export function getThemeColors(scheme: ColorScheme): ThemeColors {
  return scheme === "dark" ? darkTheme : lightTheme;
}

export const Typography = {
  displayLg: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
    letterSpacing: -0.64,
  },
  headlineMd: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
    letterSpacing: -0.24,
  },
  headlineSm: { fontSize: 20, lineHeight: 28, fontWeight: "600" as const },
  headlineSmMobile: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  headlineMdMobile: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  labelMd: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    letterSpacing: 0.6,
  },

  // Keep legacy typography for backward compatibility during migration
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: "500" as const },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  caption: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
  button: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  story: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600" as const,
    letterSpacing: -0.4,
  },
};

export const FontFamily = Platform.select({
  ios: {
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System",
  },
  android: {
    regular: "sans-serif",
    medium: "sans-serif-medium",
    semibold: "sans-serif-medium",
    bold: "sans-serif",
  },
  default: {
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System",
  },
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

/** Durations in ms. `slow` is marketing/rare only — do not use for sheets, toasts, or presses (UI budget ≤300ms). */
export const Motion = {
  fast: 120,
  normal: 220,
  slow: 360,
  spring: { damping: 18, stiffness: 180 },
} as const;
