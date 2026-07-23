import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Palette, Radius, TouchTarget, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics, type HapticKind } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'whatsapp' | 'phone';

type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Press-down haptic. Default `light`; set `false` to disable. */
  haptic?: HapticKind | false;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  icon,
  disabled,
  style,
  textStyle,
  accessibilityLabel,
  haptic = 'light',
  onPressIn,
  ...props
}: ButtonProps) {
  const { colors } = useAppTheme();

  const variantStyles: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: { backgroundColor: colors.primary },
      text: { color: colors.textInverse },
    },
    secondary: {
      container: {
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.primary,
      },
      text: { color: colors.primary },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.primary },
    },
    destructive: {
      container: { backgroundColor: colors.error },
      text: { color: colors.onError },
    },
    whatsapp: {
      container: { backgroundColor: Palette.whatsapp },
      text: { color: Palette.white },
    },
    phone: {
      container: { backgroundColor: Palette.phone },
      text: { color: Palette.white },
    },
  };

  const v = variantStyles[variant];
  const iconColor = (v.text.color as string) ?? colors.onPrimary;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.base,
        v.container,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      disabled={isDisabled}
      onPressIn={(e) => {
        if (!isDisabled && haptic) haptics.play(haptic);
        onPressIn?.(e);
      }}
      {...props}>
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={iconColor} /> : null}
          <Text style={[styles.text, v.text, textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TouchTarget.minHeight,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  text: {
    ...Typography.headlineMdMobile,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
