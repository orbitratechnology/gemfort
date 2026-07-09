import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { completeService, fetchServices } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';
import type { ServiceRecord } from '@/types';

function timelineSteps(status: ServiceRecord['status']) {
  const done = (s: ServiceRecord['status']) => {
    const order = ['given', 'in_progress', 'completed'];
    const idx = order.indexOf(status === 'received_back' ? 'completed' : status === 'overdue' ? 'in_progress' : status);
    return order.indexOf(s) <= idx;
  };
  return [
    { key: 'given', label: 'Received', sub: 'Gem accepted by provider', state: done('given') ? 'done' : 'pending' },
    {
      key: 'in_progress',
      label: 'In Progress',
      sub: 'Current stage',
      state: status === 'in_progress' || status === 'overdue' ? 'active' : done('in_progress') ? 'done' : 'pending',
    },
    { key: 'completed', label: 'Completed', sub: 'Returned & finalised', state: done('completed') ? 'done' : 'pending' },
  ] as const;
}

export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [weightAfter, setWeightAfter] = useState('');
  const [finalCost, setFinalCost] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['services', user?.uid],
    queryFn: () => fetchServices(user!.uid),
    enabled: !!user,
  });

  const service = services.find((s) => s.id === serviceId);

  if (!service) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={[styles.loading, { color: colors.textMuted }]}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const actionable = service.status === 'given' || service.status === 'overdue' || service.status === 'in_progress';
  const statusLabel = service.status.replace(/_/g, ' ').toUpperCase();

  async function handleComplete() {
    if (!user) return;
    setLoading(true);
    try {
      await completeService(serviceId!, user.uid, {
        weightAfter: parseFloat(weightAfter),
        finalCost: parseFloat(finalCost),
      });
      await queryClient.invalidateQueries({ queryKey: ['gems'] });
      await queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service marked complete');
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update service.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>Service Detail</Text>
        <View style={styles.iconBtn} />
      </View>

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Header section */}
        <View style={styles.section}>
          <View style={styles.statusRow}>
            <View style={[styles.typeChip, { backgroundColor: colors.surfaceContainerHighest }]}>
              <Icon name="diamond" size={14} color={colors.onSurface} />
              <Text style={[styles.typeChipText, { color: colors.onSurface }]}>
                {service.serviceType.replace(/_/g, ' ')}
              </Text>
            </View>
            <Text style={[styles.statusLabel, { color: colors.accent }]}>{statusLabel}</Text>
          </View>
          <Text style={[styles.title, { color: colors.primary }]}>
            {service.serviceType.replace(/_/g, ' ')}
          </Text>
          {service.instructions ? (
            <Text style={[styles.desc, { color: colors.onSurfaceVariant }]}>{service.instructions}</Text>
          ) : null}
        </View>

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Timeline</Text>
          <View style={[styles.timeline, { borderLeftColor: colors.surfaceVariant }]}>
            {timelineSteps(service.status).map((step) => {
              const active = step.state === 'active';
              const done = step.state === 'done';
              const dotColor = done || active ? colors.primary : colors.surfaceVariant;
              return (
                <View key={step.key} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: dotColor, borderColor: colors.surfaceContainerLowest }]}>
                    {done ? <Icon name="check" size={12} color={colors.onPrimary} /> : null}
                    {active ? <View style={[styles.pulse, { backgroundColor: colors.onPrimary }]} /> : null}
                  </View>
                  <View style={styles.timelineText}>
                    <Text style={[styles.timelineLabel, { color: done || active ? colors.primary : colors.textMuted }]}>
                      {step.label}
                    </Text>
                    <Text style={[styles.timelineSub, { color: colors.textMuted }]}>{step.sub}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Weight tracking */}
        <View style={styles.weightRow}>
          <View style={[styles.weightCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Icon name="scale" size={22} color={colors.textMuted} />
            <Text style={[styles.weightLabel, { color: colors.textMuted }]}>BEFORE</Text>
            <Text style={[styles.weightValue, { color: colors.primary }]}>{service.weightBefore} ct</Text>
          </View>
          <View style={[styles.weightCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Icon name="auto-awesome" size={22} color={colors.accent} />
            <Text style={[styles.weightLabel, { color: colors.textMuted }]}>
              {service.weightAfter != null ? 'AFTER' : 'EXPECTED'}
            </Text>
            <Text style={[styles.weightValue, { color: colors.primary }]}>
              {service.weightAfter != null ? `${service.weightAfter} ct` : '—'}
            </Text>
            {service.weightLossPercent != null ? (
              <Text style={[styles.weightNote, { color: colors.textMuted }]}>
                Loss ~{service.weightLossPercent}%
              </Text>
            ) : null}
          </View>
        </View>

        {/* Provider */}
        <View style={[styles.providerCard, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={styles.providerLeft}>
            <View style={[styles.providerAvatar, { backgroundColor: colors.primaryMuted }]}>
              <Icon name="person" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.providerName, { color: colors.primary }]}>
                {service.providerContactId.slice(0, 10)}
              </Text>
              <View style={styles.providerMeta}>
                <Icon name="verified" size={16} color={colors.accent} />
                <Text style={[styles.providerRole, { color: colors.textMuted }]}>Service Provider</Text>
              </View>
            </View>
          </View>
          <View style={styles.providerActions}>
            <View style={[styles.roundBtn, { backgroundColor: colors.surfaceVariant }]}>
              <Icon name="call" size={20} color={colors.onSurface} />
            </View>
            <View style={[styles.roundBtn, { backgroundColor: colors.surfaceVariant }]}>
              <Icon name="chat" size={20} color={colors.onSurface} />
            </View>
          </View>
        </View>

        {/* Cost summary */}
        {service.agreedPrice != null || service.finalCost != null ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Cost Summary</Text>
            <View style={styles.costList}>
              {service.agreedPrice != null ? (
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.onSurfaceVariant }]}>Agreed Price</Text>
                  <Text style={[styles.costValue, { color: colors.onSurface }]}>{formatCurrency(service.agreedPrice)}</Text>
                </View>
              ) : null}
              {service.advancePaid > 0 ? (
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.onSurfaceVariant }]}>Advance Paid</Text>
                  <Text style={[styles.costValue, { color: colors.onSurface }]}>{formatCurrency(service.advancePaid)}</Text>
                </View>
              ) : null}
              <View style={[styles.costTotalRow, { borderTopColor: colors.surfaceVariant }]}>
                <Text style={[styles.costTotalLabel, { color: colors.primary }]}>
                  {service.finalCost != null ? 'Final Cost' : 'Total Estimate'}
                </Text>
                <Text style={[styles.costTotalValue, { color: colors.primary }]}>
                  {formatCurrency(service.finalCost ?? service.agreedPrice ?? 0)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Complete form */}
        {actionable ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, gap: Spacing.md }]}>
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Mark as Received</Text>
            <Input label="Weight After (ct)" value={weightAfter} onChangeText={setWeightAfter} keyboardType="decimal-pad" leftIcon="scale" />
            <Input label="Final Cost (LKR)" value={finalCost} onChangeText={setFinalCost} keyboardType="decimal-pad" leftIcon="payments" />
            <Button title="Mark Received & Complete" icon="check-circle" loading={loading} onPress={handleComplete} />
          </View>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headlineMdMobile },

  content: { padding: Spacing.containerMargin, gap: Spacing.sectionGap, paddingBottom: 60 },
  section: { gap: Spacing.stackMd },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  typeChipText: { ...Typography.labelMd, textTransform: 'capitalize' },
  statusLabel: { ...Typography.labelMd },
  title: { ...Typography.headlineSm, textTransform: 'capitalize' },
  desc: { ...Typography.bodyMd },

  card: {
    borderRadius: Radius.lg,
    padding: 16,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.03,
    shadowRadius: 15,
    elevation: 2,
  },
  cardTitle: { ...Typography.headlineMdMobile, marginBottom: 16 },
  timeline: { borderLeftWidth: 2, marginLeft: 11, paddingLeft: 24, gap: 24 },
  timelineRow: { position: 'relative', flexDirection: 'row', justifyContent: 'space-between' },
  timelineDot: {
    position: 'absolute',
    left: -35,
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  timelineText: { flex: 1 },
  timelineLabel: { ...Typography.labelMd },
  timelineSub: { ...Typography.bodyMd, marginTop: 2 },

  weightRow: { flexDirection: 'row', gap: 16 },
  weightCard: {
    flex: 1,
    padding: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.02,
    shadowRadius: 15,
    elevation: 1,
  },
  weightLabel: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  weightValue: { ...Typography.headlineSm },
  weightNote: { fontSize: 10, marginTop: 4 },

  providerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: 16,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.02,
    shadowRadius: 15,
    elevation: 1,
  },
  providerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 },
  providerAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  providerName: { ...Typography.bodyLg, fontWeight: '700' },
  providerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  providerRole: { ...Typography.bodyMd },
  providerActions: { flexDirection: 'row', gap: 8 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  costList: { gap: 8 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between' },
  costLabel: { ...Typography.bodyMd },
  costValue: { ...Typography.bodyMd },
  costTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 2, borderTopWidth: 1 },
  costTotalLabel: { ...Typography.headlineSm },
  costTotalValue: { ...Typography.headlineSm },
});
