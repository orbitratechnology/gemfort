import { TourProvider } from "guideway";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_TOURS } from "@/constants/app-tours";
import { FontFamily } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

const tourStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export function AppTourProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useAppTheme();
  // The root overlay shares measureInWindow coordinates; don't add Android's top inset again.
  const tourInsets =
    Platform.OS === "android" ? { ...insets, top: 0 } : insets;

  return (
    <TourProvider
      tours={APP_TOURS}
      storage={tourStorage}
      storageKeyPrefix="gemfort.guideway.seen."
      insets={tourInsets}
      colorScheme={scheme}
      overlayTapBehavior="skip"
      theme={{
        accent: colors.primary,
        overlayColor: "rgba(0, 0, 0, 0.72)",
        tooltip: {
          backgroundColor: colors.surfaceContainerLowest,
          textColor: colors.onSurfaceVariant,
          titleColor: colors.onSurface,
          borderRadius: 20,
          padding: 18,
          maxWidth: 320,
          fontFamily: FontFamily.regular,
        },
        labels: { next: "Next", back: "Back", skip: "Skip", done: "Done" },
      }}
    >
      {children}
    </TourProvider>
  );
}
