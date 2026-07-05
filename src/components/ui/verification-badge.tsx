import { StyleSheet, Text, View } from 'react-native';

import { Palette, Typography } from '@/constants/design-tokens';

type BadgeType = 'verified' | 'basic' | 'pending' | 'revoked';

const config: Record<BadgeType, { bg: string; label: string }> = {
  verified: { bg: Palette.verifiedGreen, label: 'Verified' },
  basic: { bg: Palette.basicBlue, label: 'Basic Verified' },
  pending: { bg: Palette.pendingAmber, label: 'Pending' },
  revoked: { bg: Palette.revokedRed, label: 'Revoked' },
};

export function VerificationBadge({ type }: { type: BadgeType }) {
  const { bg, label } = config[type];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  text: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: '600',
  },
});
