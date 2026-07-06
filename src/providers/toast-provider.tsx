import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

export type ToastVariant = 'success' | 'error' | 'info';

type ToastOptions = { variant?: ToastVariant; duration?: number };

type ToastState = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, IconName> = {
  success: 'check-circle',
  error: 'error-outline',
  info: 'info-outline',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -20, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      idRef.current += 1;
      setToast({ id: idRef.current, message, variant: options?.variant ?? 'info' });
      opacity.setValue(0);
      translateY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }),
      ]).start();
      timer.current = setTimeout(hide, options?.duration ?? 3000);
    },
    [hide, opacity, translateY],
  );

  const value: ToastContextValue = {
    show,
    success: (m, d) => show(m, { variant: 'success', duration: d }),
    error: (m, d) => show(m, { variant: 'error', duration: d }),
    info: (m, d) => show(m, { variant: 'info', duration: d }),
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const accent =
    toast?.variant === 'success'
      ? colors.successEmerald
      : toast?.variant === 'error'
        ? colors.error
        : colors.primary;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrap, { top: insets.top + Spacing.sm, opacity, transform: [{ translateY }] }]}>
          <Pressable
            onPress={hide}
            style={[
              styles.toast,
              { backgroundColor: colors.surfaceContainerHighest, borderLeftColor: accent },
            ]}>
            <Icon name={VARIANT_ICON[toast.variant]} size={20} color={accent} />
            <Text style={[styles.message, { color: colors.onSurface }]} numberOfLines={3}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback so calls never crash outside the provider.
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.containerMargin,
    right: Spacing.containerMargin,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  message: { ...Typography.bodyMd, flex: 1 },
});
