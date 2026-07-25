import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type AuthStepIndicatorProps = {
  step: number;
  total: number;
  label: string;
};

/** Compact “Step X of Y” progress for multi-step auth flows. */
export function AuthStepIndicator({ step, total, label }: AuthStepIndicatorProps) {
  const { colors } = useAppTheme();
  const progress = Math.min(1, Math.max(0, step / total));

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}: ${label}`}
      accessibilityValue={{ min: 0, max: total, now: step }}>
      <View style={styles.meta}>
        <Text style={[styles.stepText, { color: colors.textMuted }]}>
          Step {step} of {total}
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceContainerHighest }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 400,
    gap: Spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  stepText: {
    ...Typography.labelMd,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  label: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
