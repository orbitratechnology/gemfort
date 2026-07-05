import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { formatGemType } from '@/constants/gem-options';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { formatCurrency } from '@/lib/utils';
import type { WorkspaceGem } from '@/types';

type GemCardProps = {
  gem: WorkspaceGem;
  onPress?: () => void;
  variant?: 'list' | 'grid';
};

export function GemCard({ gem, onPress, variant = 'list' }: GemCardProps) {
  const ts = useThemeStyles();

  if (variant === 'grid') {
    return (
      <Pressable onPress={onPress} style={styles.gridPressable}>
        <Card style={styles.gridCard}>
          {gem.photoUrls[0] ? (
            <Image source={{ uri: gem.photoUrls[0] }} style={styles.gridImage} />
          ) : (
            <View style={[styles.gridImagePlaceholder, { backgroundColor: ts.colors.primaryMuted }]} />
          )}
          <Text style={[styles.gridSku, ts.textMuted]} numberOfLines={1}>
            {gem.sku}
          </Text>
          <Text style={[styles.gridType, ts.text]} numberOfLines={1}>
            {formatGemType(gem.gemType)}
          </Text>
          <Text style={[styles.gridWeight, ts.textSecondary]}>{gem.currentWeight} ct</Text>
          <View style={[styles.gridStatusBadge, ts.surfaceMuted]}>
            <Text style={[styles.gridStatusText, ts.textPrimary]} numberOfLines={1}>
              {gem.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.row}>
          {gem.photoUrls[0] ? (
            <Image source={{ uri: gem.photoUrls[0] }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: ts.colors.primaryMuted }]} />
          )}
          <View style={styles.info}>
            <Text style={[styles.sku, ts.textMuted]}>{gem.sku}</Text>
            <Text style={[styles.type, ts.text]}>{formatGemType(gem.gemType)}</Text>
            <Text style={[styles.weight, ts.textSecondary]}>{gem.currentWeight} ct</Text>
          </View>
          <View style={[styles.statusBadge, ts.surfaceMuted]}>
            <Text style={[styles.statusText, ts.textPrimary]}>{gem.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        {gem.askingPrice ? (
          <Text style={[styles.price, ts.textAccent]}>
            {formatCurrency(gem.askingPrice, gem.askingPriceCurrency ?? 'LKR')}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  info: { flex: 1 },
  sku: { ...Typography.caption },
  type: { ...Typography.h3 },
  weight: { ...Typography.bodySmall },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    maxWidth: 96,
  },
  statusText: { ...Typography.caption, textTransform: 'capitalize' },
  price: { ...Typography.body, marginTop: Spacing.sm, fontWeight: '600' },
  gridPressable: { flex: 1, maxWidth: '50%' },
  gridCard: { marginBottom: Spacing.md, gap: 4 },
  gridImage: { width: '100%', height: 100, borderRadius: 8 },
  gridImagePlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 8,
  },
  gridSku: { ...Typography.caption },
  gridType: { ...Typography.body, fontWeight: '600' },
  gridWeight: { ...Typography.bodySmall },
  gridStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  gridStatusText: { ...Typography.caption, textTransform: 'capitalize' },
});
