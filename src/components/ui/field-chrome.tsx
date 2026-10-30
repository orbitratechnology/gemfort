import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { FontFamily, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

/**
 * Shared height for every single-line field (text, masked, select): a
 * comfortable 56dp touch target that keeps 16px text well proportioned.
 */
export const FIELD_HEIGHT = 56;

/**
 * Text metrics for field content. Poppins has a tall ascender, so a tight
 * inherited lineHeight plus Android's font padding pushes glyphs above the
 * box's centre. Field text drops both and lets the box do the centring.
 */
export const fieldText = {
  fontFamily: FontFamily.regular,
  fontSize: 16,
  includeFontPadding: false,
  textAlignVertical: 'center',
} as const;

type FieldState = {
  focused?: boolean;
  error?: boolean;
  disabled?: boolean;
};

/**
 * Visual state for a field box: soft fill with no resting border, a primary
 * border + halo on focus, the same halo in red on error. Every input-like
 * control uses this so text fields and pickers read as one family.
 * Picker fields pass their sheet's open state as `focused` and spread
 * `pressedBox` while pressed.
 */
export function useFieldChrome({ focused, error, disabled }: FieldState) {
  const { colors, isDark } = useAppTheme();
  const accent = error ? colors.error : colors.primary;
  const active = focused || error;

  const box: ViewStyle = {
    backgroundColor: active
      ? colors.surfaceContainerLowest
      : isDark
        ? colors.surfaceContainerHigh
        : colors.surfaceContainerLow,
    borderColor: active ? accent : isDark ? colors.outlineVariant : 'transparent',
    boxShadow: active ? `0 0 0 3px ${accent}${isDark ? '33' : '1F'}` : undefined,
    opacity: disabled ? 0.55 : 1,
  };
  const pressedBox: ViewStyle = {
    backgroundColor: isDark ? colors.surfaceContainerHighest : colors.surfaceContainer,
  };

  return {
    box,
    pressedBox,
    iconColor: error ? colors.error : focused ? colors.primary : colors.textMuted,
    textColor: colors.onSurface,
    placeholderColor: colors.outline,
    selectionColor: colors.primary,
  };
}

/** Tracks focus for a TextInput while preserving caller onFocus/onBlur. */
export function useFieldFocus(props: Pick<TextInputProps, 'onFocus' | 'onBlur'>) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    focusProps: {
      onFocus: ((e) => {
        setFocused(true);
        props.onFocus?.(e);
      }) as TextInputProps['onFocus'],
      onBlur: ((e) => {
        setFocused(false);
        props.onBlur?.(e);
      }) as TextInputProps['onBlur'],
    },
  };
}

/** Label above a field. */
export function FieldLabel({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return <Text style={[fieldStyles.label, { color: colors.onSurfaceVariant }]}>{children}</Text>;
}

/** Error (announced) or helper line under a field. */
export function FieldMessage({
  error,
  helperText,
  align = 'left',
}: {
  error?: string;
  helperText?: string;
  align?: 'left' | 'center';
}) {
  const { colors } = useAppTheme();
  if (error) {
    return (
      <Text
        selectable={false}
        accessibilityLiveRegion="polite"
        style={[fieldStyles.message, { color: colors.error, textAlign: align }]}>
        {error}
      </Text>
    );
  }
  if (!helperText) return null;
  return (
    <Text style={[fieldStyles.message, { color: colors.textMuted, textAlign: align }]}>
      {helperText}
    </Text>
  );
}

/** Wrapper that stacks label, box, and message with the shared rhythm. */
export function FieldWrap({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[fieldStyles.wrap, style]}>{children}</View>;
}

export const fieldStyles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  label: { ...Typography.labelMd, letterSpacing: 0.1 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: FIELD_HEIGHT,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  /** Single-line TextInput: fills the box height so the text centres in it. */
  input: {
    ...fieldText,
    flex: 1,
    alignSelf: 'stretch',
    minHeight: FIELD_HEIGHT - 2,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
  },
  /** Multiline TextInput: top-aligned with comfortable line spacing. */
  inputMultiline: {
    lineHeight: 24,
    textAlignVertical: 'top',
    paddingVertical: 15,
    minHeight: 112,
  },
  /** Display text inside a picker-style field. */
  value: { ...fieldText, lineHeight: 24, flex: 1, minWidth: 0 },
  right: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  message: { ...Typography.bodySmall, paddingHorizontal: 2 },
});
