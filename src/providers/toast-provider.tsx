import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Motion, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { easeOut, useReduceMotion } from '@/hooks/use-reduce-motion';

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
  const reduceMotion = useReduceMotion();

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastVisibleRef = useRef(false);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-20));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const hide = useCallback(() => {
    const duration = reduceMotion ? Motion.fast : Motion.normal;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: reduceMotion ? 0 : -20,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      toastVisibleRef.current = false;
      setToast(null);
    });
  }, [opacity, translateY, reduceMotion]);

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      idRef.current += 1;
      const next: ToastState = {
        id: idRef.current,
        message,
        variant: options?.variant ?? 'info',
      };
      const isReplacement = toastVisibleRef.current;

      toastVisibleRef.current = true;
      setToast(next);

      if (!isReplacement) {
        opacity.setValue(0);
        translateY.setValue(reduceMotion ? 0 : -20);
      }

      if (reduceMotion) {
        Animated.timing(opacity, {
          toValue: 1,
          duration: Motion.fast,
          easing: easeOut,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: Motion.normal,
            easing: easeOut,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: Motion.spring.damping,
            stiffness: Motion.spring.stiffness,
          }),
        ]).start();
      }
      timer.current = setTimeout(hide, options?.duration ?? 3000);
    },
    [hide, opacity, translateY, reduceMotion],
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
            <Text style={[styles.message, { color: colors.onSurface }]} numberOfLines={2}>
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
