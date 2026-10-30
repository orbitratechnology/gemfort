import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
  useFieldFocus,
} from '@/components/ui/field-chrome';
import { Icon, type IconName } from '@/components/ui/icon';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  /** Leading icon to clarify the field for non-technical users. */
  leftIcon?: IconName;
  /** Custom leading element (e.g. brand mark) — preferred over leftIcon when set. */
  leftElement?: ReactNode;
  /** Trailing element inside the field (e.g. open-link button). */
  rightElement?: ReactNode;
};

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  leftElement,
  rightElement,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { focused, focusProps } = useFieldFocus({ onFocus, onBlur });
  const chrome = useFieldChrome({
    focused,
    error: !!error,
    disabled: props.editable === false,
  });

  return (
    <FieldWrap>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View
        style={[
          fieldStyles.box,
          props.multiline && { alignItems: 'flex-start' },
          chrome.box,
        ]}>
        {props.multiline
          ? null
          : leftElement ?? (leftIcon ? <Icon name={leftIcon} size={20} color={chrome.iconColor} /> : null)}
        <TextInput
          placeholderTextColor={chrome.placeholderColor}
          selectionColor={chrome.selectionColor}
          cursorColor={chrome.selectionColor}
          style={[
            fieldStyles.input,
            { color: chrome.textColor },
            props.multiline && fieldStyles.inputMultiline,
            style,
          ]}
          accessibilityLabel={label}
          {...props}
          {...focusProps}
        />
        {rightElement ? <View style={fieldStyles.right}>{rightElement}</View> : null}
      </View>
      <FieldMessage error={error} helperText={helperText} />
    </FieldWrap>
  );
}
