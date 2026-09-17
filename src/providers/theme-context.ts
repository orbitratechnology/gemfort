import { createContext } from "react";

import type { ColorScheme, ThemeColors } from "@/constants/design-tokens";
import type { ThemePreference } from "@/lib/theme-preference";

export type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
