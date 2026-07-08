import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { MANUAL_STATUS_OPTIONS, formatGemType } from '@/constants/gem-options';
import { getGemQuickActions } from '@/features/workspace/gem-utils';
import {
    fetchGem,
    fetchGemCosts,
    fetchGemEvents,
    updateGemStatus,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';
import type { GemStatus } from '@/types';

export default function GemDetailScreen() {
  const { gemId } = useLocalSearchParams<{ gemId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: gem } = useQuery({
    queryKey: ['gem', gemId],
    queryFn: () => fetchGem(gemId!),
    enabled: !!gemId,
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['gem-costs', gemId],
    queryFn: () => fetchGemCosts(gemId!),
    enabled: !!gemId,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['gem-events', gemId],
    queryFn: () => fetchGemEvents(gemId!),
    enabled: !!gemId,
  });

  async function handleStatusChange(newStatus: GemStatus) {
    if (!user || !gem || newStatus === gem.status) return;
    try {
      await updateGemStatus(
        gem.id,
        user.uid,
        newStatus,
        `Status changed to ${newStatus.replace(/_/g, ' ')}`,
      );
      await queryClient.invalidateQueries({ queryKey: ['gem', gemId] });
      await queryClient.invalidateQueries({ queryKey: ['gem-events', gemId] });
      await queryClient.invalidateQueries({ queryKey: ['gems', user.uid] });
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update status.'));
    }
  }

  function showStatusPicker() {
    if (!gem) return;
    const options = MANUAL_STATUS_OPTIONS.filter((o) => o.value !== gem.status);
    Alert.alert(
      'Update Status',
      `Current: ${gem.status.replace(/_/g, ' ')}`,
      [
        ...options.map((o) => ({
          text: o.label,
          onPress: () => handleStatusChange(o.value),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  if (!gem) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const profit = gem.askingPrice != null ? gem.askingPrice - gem.totalCost : null;
  const roi =
    profit != null && gem.totalCost > 0
      ? ((profit / gem.totalCost) * 100).toFixed(1)
      : null;
  const quickActions = getGemQuickActions(gem);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Navigation */}
      <View style={[styles.header]}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surfaceContainerHigh }]}>
          <Icon name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.primary }]}>Gem Details</Text>
        <Pressable onPress={showStatusPicker} style={styles.iconBtn}>
          <Icon name="more-vert" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Image Carousel */}
        <View style={[styles.heroWrap, { backgroundColor: colors.surfaceContainerLowest }]}>
          {gem.photoUrls[0] ? (
            <Image source={{ uri: gem.photoUrls[0] }} style={styles.hero} />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: colors.surfaceVariant }]} />
          )}
          <View style={[styles.certBadge, { backgroundColor: colors.surfaceGlass }]}>
            <Icon name="verified" size={16} color={colors.onSurface} />
            <Text style={[styles.certText, { color: colors.onSurface }]}>Certified</Text>
          </View>
          <View style={styles.indicators}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View style={[styles.dot, { backgroundColor: colors.surfaceVariant }]} />
            <View style={[styles.dot, { backgroundColor: colors.surfaceVariant }]} />
          </View>
        </View>

        {/* Title & Badges */}
        <View style={styles.titleSection}>
          <View style={styles.titleLeft}>
            <Text style={[styles.gemName, { color: colors.primary }]}>{formatGemType(gem.gemType)}</Text>
            <Text style={[styles.sku, { color: colors.outline }]}>SKU: {gem.sku}</Text>
          </View>
          <View style={[styles.premiumBadge, { backgroundColor: colors.secondaryContainer }]}>
            <Icon name="star" size={14} color={colors.onSecondaryContainer} />
            <Text style={[styles.premiumText, { color: colors.onSecondaryContainer }]}>Premium</Text>
          </View>
        </View>

        {/* Detailed Properties (Bento Grid) */}
        <View style={styles.bentoGrid}>
          <View style={[styles.bentoBox, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.bentoLabel, { color: colors.outline }]}>Weight</Text>
            <Text style={[styles.bentoValue, { color: colors.primary }]}>{gem.currentWeight} ct</Text>
          </View>
          <View style={[styles.bentoBox, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.bentoLabel, { color: colors.outline }]}>Color</Text>
            <Text style={[styles.bentoValue, { color: colors.primary }]}>{gem.colorPrimary || 'N/A'}</Text>
          </View>
          <View style={[styles.bentoBox, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.bentoLabel, { color: colors.outline }]}>Treatment</Text>
            <Text style={[styles.bentoValue, { color: colors.primary }]}>{gem.treatmentStatus || 'None'}</Text>
          </View>
          <View style={[styles.bentoBox, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.bentoLabel, { color: colors.outline }]}>Origin</Text>
            <View style={styles.bentoValueRow}>
              <Icon name="location-on" size={16} color={colors.primary} />
              <Text style={[styles.bentoValue, { color: colors.primary }]} numberOfLines={1}>{gem.originCountry || 'Unknown'}</Text>
            </View>
          </View>
        </View>

        {/* Event History / Timeline */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Gem History</Text>
          <View style={[styles.timeline, { borderLeftColor: colors.surfaceVariant }]}>
            {events.length ? (
              events.map((e, i) => (
                <View key={e.id} style={styles.timelineEvent}>
                  <View style={[styles.timelineDot, { backgroundColor: i === 0 ? colors.primary : colors.surfaceVariant, borderColor: colors.surfaceContainerLowest }]} />
                  <Text style={[styles.timelineDate, { color: colors.outline }]}>{formatDate(e.createdAt)}</Text>
                  <Text style={[styles.timelineTitle, { color: colors.primary }]}>{e.description}</Text>
                  {e.weightAtEvent && (
                    <Text style={[styles.timelineDesc, { color: colors.onSurfaceVariant }]}>{e.weightAtEvent} ct</Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textMuted }}>No events yet</Text>
            )}
          </View>
        </View>

        {/* Financial Breakdown (Private) */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant + '4D', borderWidth: 1 }]}>
          <View style={styles.financeHeader}>
            <Icon name="lock" size={18} color={colors.outline} />
            <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 0 }]}>Financials (Private)</Text>
          </View>
          <View style={styles.financeList}>
            {costs.length ? (
              costs.map((c) => (
                <View key={c.id} style={styles.financeRow}>
                  <Text style={[styles.financeLabel, { color: colors.onSurfaceVariant }]}>{c.costType}</Text>
                  <Text style={[styles.financeValue, { color: colors.primary }]}>{formatCurrency(c.amount, c.currency)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textMuted, marginBottom: 8 }}>No cost lines yet</Text>
            )}
            <View style={[styles.divider, { backgroundColor: colors.surfaceVariant }]} />
            <View style={styles.financeRow}>
              <Text style={[styles.financeTotalLabel, { color: colors.primary }]}>Total Cost Basis</Text>
              <Text style={[styles.financeTotalValue, { color: colors.primary }]}>{formatCurrency(gem.totalCost, gem.totalCostCurrency)}</Text>
            </View>
            {profit != null && (
              <View style={[styles.financeRow, { marginTop: 8 }]}>
                <Text style={[styles.financeTotalLabel, { color: colors.successEmerald }]}>Est. Profit</Text>
                <Text style={[styles.financeTotalValue, { color: colors.successEmerald }]}>{formatCurrency(profit)} {roi ? `(${roi}%)` : ''}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionArea}>
          <Button 
            title="Create Listing" 
            onPress={() => router.push('/listings/create')} 
            style={[styles.mainActionBtn, { backgroundColor: colors.primary }]}
            textStyle={{ color: colors.onPrimary }}
          />
          <View style={styles.secondaryActions}>
            {quickActions.map((action) => (
              <Button
                key={action.title}
                title={action.title}
                variant="secondary"
                onPress={() => router.push(action.href as never)}
                style={styles.secActionBtn}
              />
            ))}
          </View>
        </View>

      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
    zIndex: 40,
    height: 64,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.headlineSmMobile },
  
  content: { padding: Spacing.containerMargin, gap: Spacing.sectionGap, paddingBottom: 100 },
  
  heroWrap: { width: '100%', height: 300, borderRadius: Radius.lg, overflow: 'hidden', shadowColor: '#00162C', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 },
  hero: { width: '100%', height: '100%' },
  heroPlaceholder: { width: '100%', height: '100%' },
  certBadge: { position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  certText: { ...Typography.labelMd },
  indicators: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  titleSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleLeft: { flex: 1 },
  gemName: { ...Typography.displayLg },
  sku: { ...Typography.bodyMd, marginTop: 4 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  premiumText: { ...Typography.labelMd },

  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.stackMd },
  bentoBox: { width: '48%', padding: 16, borderRadius: Radius.lg, shadowColor: '#00162C', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3, justifyContent: 'center' },
  bentoLabel: { ...Typography.labelMd, marginBottom: 4 },
  bentoValue: { ...Typography.headlineSmMobile },
  bentoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  card: { padding: 20, borderRadius: Radius.lg, shadowColor: '#00162C', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 },
  sectionTitle: { ...Typography.headlineSmMobile, marginBottom: 16 },
  
  timeline: { borderLeftWidth: 1, marginLeft: 12, paddingLeft: 24, gap: 24 },
  timelineEvent: { position: 'relative' },
  timelineDot: { position: 'absolute', left: -31, top: 4, width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  timelineDate: { ...Typography.bodyMd, marginBottom: 4 },
  timelineTitle: { ...Typography.headlineMdMobile, fontSize: 16, lineHeight: 20, marginBottom: 4 },
  timelineDesc: { ...Typography.bodyMd, fontSize: 13 },

  financeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  financeList: { gap: 12 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  financeLabel: { ...Typography.bodyMd },
  financeValue: { ...Typography.bodyMd, fontWeight: '600' },
  divider: { height: 1, marginVertical: 4 },
  financeTotalLabel: { ...Typography.headlineSmMobile, fontSize: 16 },
  financeTotalValue: { ...Typography.headlineSmMobile, fontSize: 16 },

  actionArea: { gap: Spacing.stackMd, marginTop: 16 },
  mainActionBtn: { height: 48, borderRadius: Radius.full },
  secondaryActions: { flexDirection: 'row', gap: Spacing.stackMd },
  secActionBtn: { flex: 1, height: 48, borderRadius: Radius.full },
});
