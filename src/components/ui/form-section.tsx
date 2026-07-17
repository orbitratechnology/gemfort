import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type FormSectionLabelProps = {
  /** Section eyebrow — rendered uppercase above the group. */
  title: string;
};

/**
 * Muted uppercase label above a full-bleed form group.
 * Stays outside the section surface (Edit Business pattern).
 */
export function FormSectionLabel({ title }: FormSectionLabelProps) {
  const { colors } = useAppTheme();
  return (
    <Text
      style={[styles.label, { color: colors.textMuted }]}
      accessibilityRole="header">
      {title.trim().toUpperCase()}
    </Text>
  );
}

type FormSectionProps = {
  children: ReactNode;
  /**
   * When set, renders {@link FormSectionLabel} above the group
   * (outside the surface). Prefer this over nesting titles inside.
   */
  title?: string;
  /** Optional helper under the label, still above the surface. */
  hint?: string;
  /** @deprecated Kept for call-site compatibility; not rendered. */
  icon?: IconName;
  /** Horizontal + vertical padding inside the group. Default true. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Edge-to-edge surface group — no radius, no side margin, no card shadow.
 * Screen scroll content must not add horizontal padding, or sections won't bleed.
 * Use {@link ScreenInset} for lead copy, CTAs, and other non-section content.
 */
export function FormSection({
  children,
  title,
  hint,
  padded = true,
  style,
}: FormSectionProps) {
  const { colors } = useAppTheme();

  const group = (
    <View
      style={[
        styles.group,
        padded && styles.groupPadded,
        { backgroundColor: colors.surfaceContainerLowest },
        style,
      ]}>
      {children}
    </View>
  );

  if (!title && !hint) return group;

  return (
    <View style={styles.block}>
      {title ? <FormSectionLabel title={title} /> : null}
      {hint ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
      {group}
    </View>
  );
}

type ScreenInsetProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Aligns non-section content with the inner padding of padded FormSections. */
export function ScreenInset({ children, style }: ScreenInsetProps) {
  return <View style={[styles.inset, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    gap: 2,
  },
  label: {
    ...Typography.labelMd,
    letterSpacing: 1.1,
    paddingHorizontal: Spacing.containerMargin,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  hint: {
    ...Typography.bodySmall,
    paddingHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  group: {
    width: '100%',
    overflow: 'hidden',
  },
  groupPadded: {
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  inset: {
    paddingHorizontal: Spacing.containerMargin,
  },
});
