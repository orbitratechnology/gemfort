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
import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
  useFieldFocus,
} from '@/components/ui/field-chrome';
import { Icon } from '@/components/ui/icon';
import { Typography } from '@/constants/design-tokens';
import {
  BASE_CURRENCY,
  getCurrencyBadge,
  resolveCurrencyCode,
  type CurrencyCode,
} from '@/constants/currencies';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { formatGroupedAmount, toFaceAmount } from '@/lib/money/mask';

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
 * Auto thousand-separators as you type — no forced .00 / cents padding.
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
  placeholder = '0',
  onFocus,
  onBlur,
  ...inputProps
}: CurrencyAmountFieldProps) {
  const { colors } = useAppTheme();
  const { focused, focusProps } = useFieldFocus({ onFocus, onBlur });
  const chrome = useFieldChrome({ focused, error: !!error, disabled });
  const preferred = usePreferredCurrency();
  const [pickerOpen, setPickerOpen] = useState(false);

  const currency = resolveCurrencyCode(
    value.currency || defaultCurrency || preferred,
    BASE_CURRENCY,
  );

  return (
    <FieldWrap>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View style={[fieldStyles.box, styles.box, chrome.box]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Currency ${currency}`}
          disabled={disabled}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            styles.currencyBtn,
            {
              borderRightColor: colors.outlineVariant,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <CurrencyFlag currency={currency} size="sm" />
          <Text style={[styles.currencyCode, { color: colors.onSurface }]}>
            {getCurrencyBadge(currency)}
          </Text>
          <Icon name="expand-more" size={18} color={colors.textMuted} />
        </Pressable>
        <TextInput
          {...inputProps}
          editable={!disabled}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={chrome.placeholderColor}
          selectionColor={chrome.selectionColor}
          cursorColor={chrome.selectionColor}
          value={formatGroupedAmount(value.amount)}
          onChangeText={(text) => {
            onChange({
              amount: toFaceAmount(text),
              currency,
            });
          }}
          style={[fieldStyles.input, styles.numeric, { color: chrome.textColor }]}
          accessibilityLabel={label ?? 'Amount'}
          {...focusProps}
        />
      </View>
      <FieldMessage error={error} helperText={helperText} />

      <CurrencyPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={currency}
        onSelect={(next) => onChange({ amount: value.amount, currency: next })}
      />
    </FieldWrap>
  );
}

const styles = StyleSheet.create({
  box: { paddingLeft: 0 },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    paddingLeft: 14,
    paddingRight: 10,
    marginVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  currencyCode: {
    ...Typography.labelMd,
    fontVariant: ['tabular-nums'],
  },
  numeric: { fontVariant: ['tabular-nums'] },
});
