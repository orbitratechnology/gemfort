import { type ReactNode } from "react";
import { Pressable } from "react-native";
import { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast, Toaster } from "sonner-native";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

export type ToastVariant = "success" | "error" | "info";

type ToastOptions = { variant?: ToastVariant; duration?: number };

type ToastApi = {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
};

/**
 * Thin facade over [sonner-native](https://sonner-native.netlify.app/) so existing
 * `useToast().success/error/info` call sites keep working.
 * Place `<Toaster />` in the Expo Router root layout (via this provider).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  // sonner-native: when `offset` is set it replaces safe-area insets entirely
  // (see getInsetValues). Always include status-bar / notch inset.
  const topOffset = insets.top + Spacing.sm;

  const toastSurface = {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderCurve: "continuous" as const,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    boxShadow: isDark
      ? "0 8px 28px rgba(0, 0, 0, 0.45)"
      : "0 8px 28px rgba(0, 22, 44, 0.12)",
  };

  return (
    <>
      {children}
      <Toaster
        theme={isDark ? "dark" : "light"}
        position="top-center"
        closeButton={false}
        swipeToDismissDirection="up"
        visibleToasts={3}
        duration={3200}
        gap={10}
        offset={topOffset}
        enableStacking
        positionerStyle={{ width: "100%", left: 0, right: 0 }}
        animation={{
          enter: FadeInUp.duration(280).springify().damping(18),
          exit: FadeOutUp.duration(180),
        }}
        ToastWrapper={({ toastId, children: toastChildren, style, ...rest }) => (
          <Pressable
            {...rest}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={() => toast.dismiss(toastId)}
            // Must span the positioner: toasts are position:absolute;width:100%.
            // A shrink-wrapped wrapper shifts them off-center (half off-screen).
            style={[{ width: "100%", alignSelf: "stretch" }, style]}
          >
            {toastChildren}
          </Pressable>
        )}
        toastOptions={{
          style: toastSurface,
          toastContainerStyle: { width: "100%" },
          titleStyle: {
            ...Typography.bodyMd,
            color: colors.onSurface,
            fontWeight: "600",
          },
          descriptionStyle: {
            ...Typography.bodySmall,
            color: colors.textMuted,
          },
          success: toastSurface,
          error: toastSurface,
          warning: toastSurface,
          info: toastSurface,
        }}
        icons={{
          success: (
            <Icon name="check-circle" size={18} color={colors.successEmerald} />
          ),
          error: <Icon name="error" size={18} color={colors.error} />,
          warning: (
            <Icon name="warning" size={18} color={colors.warningAmber} />
          ),
          info: <Icon name="info" size={18} color={colors.primary} />,
        }}
      />
    </>
  );
}

function showToast(message: string, options?: ToastOptions) {
  const duration = options?.duration;
  const variant = options?.variant ?? "info";
  if (variant === "success") {
    toast.success(message, { duration });
    return;
  }
  if (variant === "error") {
    toast.error(message, { duration });
    return;
  }
  toast(message, { duration });
}

/** App-wide toast API — backed by sonner-native. */
export function useToast(): ToastApi {
  return {
    show: showToast,
    success: (message, duration) => toast.success(message, { duration }),
    error: (message, duration) => toast.error(message, { duration }),
    info: (message, duration) => toast(message, { duration }),
  };
}
