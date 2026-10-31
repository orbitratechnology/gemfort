import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import {
  FIELD_HEIGHT,
  FieldMessage,
  fieldText,
  useFieldChrome,
  useFieldFocus,
} from '@/components/ui/field-chrome';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/design-tokens';
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
  onFocus,
  onBlur,
  ...props
}: AuthFieldProps) {
  const { colors } = useAppTheme();
  const { focused, focusProps } = useFieldFocus({ onFocus, onBlur });
  const chrome = useFieldChrome({ focused, error: !!error });

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          chrome.box,
          !focused && !error && {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: 'transparent',
          },
        ]}>
        <Icon name={leftIcon} size={20} color={chrome.iconColor} />
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder ?? label}
          placeholderTextColor={chrome.placeholderColor}
          selectionColor={chrome.selectionColor}
          cursorColor={chrome.selectionColor}
          style={[styles.input, { color: chrome.textColor }, style]}
          {...props}
          {...focusProps}
        />
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
      <FieldMessage error={error} align="center" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: FIELD_HEIGHT,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  input: {
    ...fieldText,
    flex: 1,
    alignSelf: 'stretch',
    minHeight: FIELD_HEIGHT - 2,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
});
