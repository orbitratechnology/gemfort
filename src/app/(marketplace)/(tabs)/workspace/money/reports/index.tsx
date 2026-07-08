import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  MONEY_PERIODS,
  type MoneyPeriod,
} from '@/features/workspace/money-utils';
import {
  REPORT_TYPES,
  buildReportHtml,
  exportReportPdf,
} from '@/features/workspace/report-service';
import {
  fetchCheques,
  fetchGems,
  fetchPayables,
  fetchReceivables,
  fetchTransactions,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { FinancialReportType } from '@/types';

export default function ReportsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const uid = user?.uid;

  const [period, setPeriod] = useState<MoneyPeriod>('this_month');
  const [exporting, setExporting] = useState<FinancialReportType | null>(null);

  const txQuery = useQuery({
    queryKey: ['transactions', uid],
    queryFn: () => fetchTransactions(uid!),
    enabled: !!uid,
  });
  const gemsQuery = useQuery({
    queryKey: ['gems', uid],
    queryFn: () => fetchGems(uid!),
    enabled: !!uid,
  });
  const recQuery = useQuery({
    queryKey: ['receivables', uid],
    queryFn: () => fetchReceivables(uid!),
    enabled: !!uid,
  });
  const payQuery = useQuery({
    queryKey: ['payables', uid],
    queryFn: () => fetchPayables(uid!),
    enabled: !!uid,
  });
  const chequeQuery = useQuery({
    queryKey: ['cheques', uid],
    queryFn: () => fetchCheques(uid!),
    enabled: !!uid,
  });

  const reportData = useMemo(
    () => ({
      transactions: txQuery.data ?? [],
      gems: gemsQuery.data ?? [],
      receivables: recQuery.data ?? [],
      payables: payQuery.data ?? [],
      cheques: chequeQuery.data ?? [],
    }),
    [txQuery.data, gemsQuery.data, recQuery.data, payQuery.data, chequeQuery.data],
  );

  const loading =
    txQuery.isLoading ||
    gemsQuery.isLoading ||
    recQuery.isLoading ||
    payQuery.isLoading ||
    chequeQuery.isLoading;

  async function handleExport(type: FinancialReportType) {
    setExporting(type);
    try {
      const html = buildReportHtml(type, period, reportData);
      const meta = REPORT_TYPES.find((r) => r.id === type);
      await exportReportPdf(html, `GemFort-${meta?.label ?? type}.pdf`);
      toast.success('Report ready to share.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not generate PDF.'));
    } finally {
      setExporting(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Reports" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Export financial summaries as PDF to share with your accountant or partners.
        </Text>

        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
          {MONEY_PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPeriod(p.id)}
                style={[styles.segmentBtn, active && { backgroundColor: colors.surfaceContainerLowest }]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.primary : colors.onSurfaceVariant },
                  ]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading data…</Text>
          </View>
        ) : (
          REPORT_TYPES.map((report) => {
            const busy = exporting === report.id;
            return (
              <Pressable
                key={report.id}
                onPress={() => handleExport(report.id)}
                disabled={!!exporting}
                style={({ pressed }) => [
                  styles.reportRow,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                  pressed && { opacity: 0.85 },
                ]}>
                <View style={[styles.reportIcon, { backgroundColor: colors.primary + '14' }]}>
                  <Icon name="description" size={22} color={colors.primary} />
                </View>
                <View style={styles.reportBody}>
                  <Text style={[styles.reportTitle, { color: colors.onSurface }]}>{report.label}</Text>
                  <Text style={[styles.reportSub, { color: colors.textMuted }]}>{report.subtitle}</Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Icon name="share" size={20} color={colors.primary} />
                )}
              </Pressable>
            );
          })
        )}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.section, gap: Spacing.lg },
  subtitle: { ...Typography.bodyMd },
  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.full, gap: 4 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: Radius.full, alignItems: 'center' },
  segmentText: { ...Typography.labelMd },
  loading: { alignItems: 'center', paddingVertical: Spacing.section, gap: Spacing.sm },
  loadingText: { ...Typography.bodyMd },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBody: { flex: 1, gap: 2 },
  reportTitle: { ...Typography.labelMd, fontWeight: '700' },
  reportSub: { ...Typography.bodySmall },
});
