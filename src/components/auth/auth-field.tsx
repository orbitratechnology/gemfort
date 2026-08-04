import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type AuthFieldProps = TextInputProps & {
  /** Used for accessibility; placeholder carries the visible label. */
  label: string;
  leftIcon: IconName;
  error?: string;
  rightElement?: ReactNode;
};

/** Pill auth input — light fill, no border, leading icon (popular-app style). */
export function AuthField({
  label,
  leftIcon,
  error,
  rightElement,
  style,
  placeholder,
  ...props
}: AuthFieldProps) {
  const { colors } = useAppTheme();
  const iconColor = error ? colors.error : colors.textMuted;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: error ? colors.error : 'transparent',
          },
        ]}>
        <Icon name={leftIcon} size={20} color={iconColor} />
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder ?? label}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }, style]}
          {...props}
        />
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
      {error ? (
        <Text
          selectable={false}
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  input: {
    ...Typography.bodyLarge,
    flex: 1,
    paddingVertical: 14,
    minHeight: 52,
    fontSize: 16,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  error: {
    ...Typography.bodySmall,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
});
