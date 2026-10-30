import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { fieldText, useFieldChrome, useFieldFocus } from '@/components/ui/field-chrome';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/design-tokens';

/** Search bars sit a step below form fields but keep a full touch target. */
export const SEARCH_HEIGHT = 48;

type SearchFieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Outer container style (margins, flex). */
  style?: StyleProp<ViewStyle>;
  /** Hide the trailing clear button (e.g. when a screen renders its own). */
  hideClear?: boolean;
};

/**
 * Pill search bar shared by screens and picker sheets: leading search icon,
 * centred Poppins text, focus halo, and a clear button once there is a query.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  style,
  hideClear,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...props
}: SearchFieldProps) {
  const inputRef = useRef<TextInputInstance>(null);
  const { focused, focusProps } = useFieldFocus({ onFocus, onBlur });
  const chrome = useFieldChrome({ focused });

  return (
    <View style={[styles.box, chrome.box, style]}>
      <Icon name="search" size={20} color={chrome.iconColor} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={chrome.placeholderColor}
        selectionColor={chrome.selectionColor}
        cursorColor={chrome.selectionColor}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[styles.input, { color: chrome.textColor }]}
        {...props}
        {...focusProps}
      />
      {value && !hideClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={() => {
            onChangeText('');
            inputRef.current?.focus();
          }}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
          <Icon name="cancel" size={18} color={chrome.placeholderColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: SEARCH_HEIGHT,
    paddingLeft: 16,
    paddingRight: 12,
    borderWidth: 1,
    borderRadius: Radius.full,
    borderCurve: 'continuous',
  },
  input: {
    ...fieldText,
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
  },
  clear: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
