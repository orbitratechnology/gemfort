import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { CurrencyFlag } from '@/components/ui/country-flag';
import { CurrencyPickerSheet } from '@/components/ui/currency-picker-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  BASE_CURRENCY,
  getCurrencyBadge,
  resolveCurrencyCode,
  type CurrencyCode,
} from '@/constants/currencies';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';

export type CurrencyAmountValue = {
  amount: string;
  currency: CurrencyCode;
};

type CurrencyAmountFieldProps = Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'onChange' | 'keyboardType'
> & {
  label?: string;
  error?: string;
  helperText?: string;
  value: CurrencyAmountValue;
  onChange: (next: CurrencyAmountValue) => void;
  /** When omitted, defaults to the signed-in user's preferred currency. */
  defaultCurrency?: CurrencyCode;
  disabled?: boolean;
};

/**
 * Amount entry with currency selector (phone-field style).
 * Emits face amount + ISO currency; callers convert to LKR on save.
 */
export function CurrencyAmountField({
  label,
  error,
  helperText,
  value,
  onChange,
  defaultCurrency,
  disabled,
  placeholder = '0.00',
  ...inputProps
}: CurrencyAmountFieldProps) {
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const [pickerOpen, setPickerOpen] = useState(false);

  const currency = resolveCurrencyCode(
    value.currency || defaultCurrency || preferred,
    BASE_CURRENCY,
  );
  const borderColor = error ? colors.error : colors.border;

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
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Currency ${currency}`}
          disabled={disabled}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            styles.currencyBtn,
            {
              backgroundColor: colors.surfaceContainerHighest,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <CurrencyFlag currency={currency} size="sm" />
          <Text
            style={[styles.currencyCode, { color: colors.onSurface }]}
            selectable
          >
            {getCurrencyBadge(currency)}
          </Text>
          <Icon name="expand-more" size={18} color={colors.outline} />
        </Pressable>
        <TextInput
          {...inputProps}
          editable={!disabled}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value.amount}
          onChangeText={(amount) => onChange({ amount, currency })}
          style={[styles.input, { color: colors.text }]}
          accessibilityLabel={label ?? 'Amount'}
        />
      </View>
      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite"
          selectable
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      ) : null}

      <CurrencyPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={currency}
        onSelect={(next) => onChange({ amount: value.amount, currency: next })}
      />
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
    paddingRight: Spacing.gutterMd,
    minHeight: 52,
  },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    borderTopLeftRadius: Radius.lg - 2,
    borderBottomLeftRadius: Radius.lg - 2,
    borderCurve: 'continuous',
  },
  currencyCode: {
    ...Typography.labelMd,
    fontVariant: ['tabular-nums'],
  },
  input: {
    flex: 1,
    ...Typography.bodyLg,
    fontVariant: ['tabular-nums'],
    paddingVertical: Spacing.sm,
  },
  error: { ...Typography.bodySmall },
  helper: { ...Typography.bodySmall },
});
