import type { ReactNode, Ref } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  MaskedTextInput,
  type MaskedTextInputProps,
} from 'react-native-mask-text';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatGroupedAmount, toFaceAmount } from '@/lib/money/mask';

type MaskMode = 'currency' | 'weight' | 'percent' | 'custom' | 'date' | 'time';

type MaskedInputProps = Omit<
  MaskedTextInputProps,
  'onChangeText' | 'type' | 'options' | 'mask' | 'value'
> & {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: IconName;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  /** Face-value string for currency/weight/percent (e.g. "1234.5"). */
  value?: string;
  /**
   * Emits the face amount for currency/weight/percent (no grouping commas),
   * or the masked display string for custom/date/time.
   */
  onChangeText: (text: string, rawText: string) => void;
  mode?: MaskMode;
  /** Required when mode is "custom". */
  mask?: string;
  dateFormat?: string;
  timeFormat?: string;
  inputRef?: Ref<any>;
};

/**
 * Input-styled field with masking.
 * Money-like modes: thousand separators as you type (no forced .00).
 * Custom/date/time: react-native-mask-text patterns.
 */
export function MaskedInput({
  label,
  error,
  helperText,
  leftIcon,
  leftElement,
  rightElement,
  style,
  mode = 'custom',
  mask,
  dateFormat = 'dd/mm/yyyy',
  timeFormat = 'HH:mm',
  value,
  onChangeText,
  inputRef,
  ...props
}: MaskedInputProps) {
  const { colors } = useAppTheme();
  const borderColor = error ? colors.error : colors.border;
  const iconColor = error ? colors.error : colors.textMuted;

  const isMoneyLike =
    mode === 'currency' || mode === 'weight' || mode === 'percent';

  const maskOptions =
    mode === 'date'
      ? { dateFormat }
      : mode === 'time'
        ? { timeFormat }
        : undefined;

  const maskType =
    mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'custom';

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor,
            borderRadius: Radius.lg,
            borderCurve: 'continuous',
          },
        ]}
      >
        {leftElement ??
          (leftIcon ? <Icon name={leftIcon} size={20} color={iconColor} /> : null)}
        {isMoneyLike ? (
          <TextInput
            ref={inputRef}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text }, style]}
            accessibilityLabel={label}
            keyboardType="decimal-pad"
            value={formatGroupedAmount(value ?? '')}
            onChangeText={(text) => {
              const face = toFaceAmount(text);
              onChangeText(face, face);
            }}
            placeholder={props.placeholder ?? '0'}
            {...props}
          />
        ) : (
          <MaskedTextInput
            ref={inputRef}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text }, style]}
            accessibilityLabel={label}
            keyboardType={
              mode === 'date' || mode === 'time'
                ? 'numeric'
                : props.keyboardType
            }
            type={maskType}
            mask={mask}
            options={maskOptions}
            value={value ?? ''}
            onChangeText={(masked, raw) => {
              onChangeText(masked, raw);
            }}
            {...props}
          />
        )}
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
      {error ? (
        <Text
          selectable={false}
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>
          {helperText}
        </Text>
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
    fontVariant: ['tabular-nums'],
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  error: { ...Typography.bodySmall },
  helper: { ...Typography.bodySmall },
});
