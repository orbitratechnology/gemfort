import { StyleSheet, TextInput, View, Text, type TextInputProps } from 'react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...props }: InputProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: error ? Palette.error : colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { ...Typography.labelMd },
  input: {
    ...Typography.bodyMd,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.gutterMd,
    paddingVertical: 12,
    minHeight: 48,
  },
  error: { ...Typography.bodySmall, color: Palette.error },
});
