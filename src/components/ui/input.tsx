import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, Text, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  /** Leading icon to clarify the field for non-technical users. */
  leftIcon?: IconName;
  /** Custom leading element (e.g. brand mark) — preferred over leftIcon when set. */
  leftElement?: ReactNode;
};

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  leftElement,
  style,
  ...props
}: InputProps) {
  const { colors } = useAppTheme();
  const borderColor = error ? colors.error : colors.border;
  const iconColor = error ? colors.error : colors.textMuted;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor,
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
          },
        ]}>
        {leftElement ?? (leftIcon ? <Icon name={leftIcon} size={20} color={iconColor} /> : null)}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }, style]}
          accessibilityLabel={label}
          {...props}
        />
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...Typography.labelMd },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.gutterMd,
    minHeight: 52,
  },
  input: {
    ...Typography.bodyMd,
    flex: 1,
    paddingVertical: 14,
    minHeight: 52,
    fontSize: 16,
  },
  error: { ...Typography.bodySmall },
  helper: { ...Typography.bodySmall },
});
