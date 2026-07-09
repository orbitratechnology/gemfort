import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import type { IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type FormFooterProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  secondaryTitle?: string;
  onSecondaryPress?: () => void;
};

/** Sticky bottom CTA bar for form screens. Respects home-indicator inset. */
export function FormFooter({
  title,
  onPress,
  loading,
  disabled,
  icon,
  secondaryTitle,
  onSecondaryPress,
}: FormFooterProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.outlineVariant,
          paddingBottom: Math.max(insets.bottom, Spacing.md),
        },
      ]}>
      {secondaryTitle && onSecondaryPress ? (
        <View style={styles.row}>
          <Button
            title={secondaryTitle}
            variant="secondary"
            onPress={onSecondaryPress}
            style={styles.half}
          />
          <Button
            title={title}
            icon={icon}
            loading={loading}
            disabled={disabled}
            onPress={onPress}
            style={styles.half}
          />
        </View>
      ) : (
        <Button
          title={title}
          icon={icon}
          loading={loading}
          disabled={disabled}
          onPress={onPress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
});
