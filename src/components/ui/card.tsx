import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type CardProps = ViewProps & {
  featured?: boolean;
  muted?: boolean;
};

export function Card({ featured, muted, style, children, ...props }: CardProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: muted ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
          shadowColor: colors.cardShadow,
        },
        featured && {
          borderLeftWidth: 3,
          borderLeftColor: colors.accent,
          backgroundColor: colors.accentSoft,
        },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
});
