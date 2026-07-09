import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type FormSectionProps = ViewProps & {
  title?: string;
  hint?: string;
  icon?: IconName;
  children: React.ReactNode;
};

/** Grouped form card with optional title. One job per section. */
export function FormSection({ title, hint, icon, children, style, ...props }: FormSectionProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceContainerLowest },
        style,
      ]}
      {...props}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {icon ? (
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}>
                <Icon name={icon} size={18} color={colors.onPrimaryContainer} />
              </View>
            ) : null}
            <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
          </View>
          {hint ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    gap: Spacing.md,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  header: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.headlineSmMobile, flexShrink: 1 },
  hint: { ...Typography.bodySmall, lineHeight: 18 },
  body: { gap: Spacing.md },
});
