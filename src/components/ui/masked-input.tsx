import type { ReactNode, Ref } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  MaskedTextInput,
  type MaskedTextInputProps,
} from 'react-native-mask-text';

import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
  useFieldFocus,
} from '@/components/ui/field-chrome';
import { Icon, type IconName } from '@/components/ui/icon';
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
  onFocus,
  onBlur,
  ...props
}: MaskedInputProps) {
  const { focused, focusProps } = useFieldFocus({ onFocus, onBlur });
  const chrome = useFieldChrome({
    focused,
    error: !!error,
    disabled: props.editable === false,
  });

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
    <FieldWrap>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View style={[fieldStyles.box, chrome.box]}>
        {leftElement ??
          (leftIcon ? <Icon name={leftIcon} size={20} color={chrome.iconColor} /> : null)}
        {isMoneyLike ? (
          <TextInput
            ref={inputRef}
            placeholderTextColor={chrome.placeholderColor}
            selectionColor={chrome.selectionColor}
            cursorColor={chrome.selectionColor}
            style={[fieldStyles.input, styles.numeric, { color: chrome.textColor }, style]}
            accessibilityLabel={label}
            keyboardType="decimal-pad"
            value={formatGroupedAmount(value ?? '')}
            onChangeText={(text) => {
              const face = toFaceAmount(text);
              onChangeText(face, face);
            }}
            placeholder={props.placeholder ?? '0'}
            {...props}
            {...focusProps}
          />
        ) : (
          <MaskedTextInput
            ref={inputRef}
            placeholderTextColor={chrome.placeholderColor}
            selectionColor={chrome.selectionColor}
            cursorColor={chrome.selectionColor}
            style={[fieldStyles.input, styles.numeric, { color: chrome.textColor }, style]}
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
            {...focusProps}
          />
        )}
        {rightElement ? <View style={fieldStyles.right}>{rightElement}</View> : null}
      </View>
      <FieldMessage error={error} helperText={helperText} />
    </FieldWrap>
  );
}

const styles = StyleSheet.create({
  numeric: { fontVariant: ['tabular-nums'] },
});
