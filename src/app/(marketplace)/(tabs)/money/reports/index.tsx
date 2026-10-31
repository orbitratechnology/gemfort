import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CashFlowChart } from '@/components/money/cash-flow-chart';
import { SegmentedControl } from '@/components/money/segmented-control';
import { KeyStats } from '@/components/ui/detail-kit';
import { Icon, type IconName } from '@/components/ui/icon';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import {
  getCashFlowBuckets,
  getPeriodRange,
  getRangeTotals,
  MONEY_PERIODS,
  type MoneyPeriod,
} from '@/features/workspace/money-utils';
import {
  REPORT_TYPES,
  buildReportHtml,
  exportReportPdf,
} from '@/features/workspace/report-service';
import {
  subscribeCheques,
  subscribeGems,
  subscribeOpenPayables,
  subscribeOpenReceivables,
  subscribeTransactionsInRange,
} from '@/features/workspace/firestore-subscriptions';
import {
  fetchCheques,
  fetchGems,
  fetchOpenPayables,
  fetchOpenReceivables,
  fetchTransactionsInRange,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { FinancialReportType } from '@/types';

const REPORT_ICONS: Record<FinancialReportType, IconName> = {
  profit_loss: 'insights',
  cash_flow: 'swap-vert',
  inventory_value: 'diamond',
  outstanding_payments: 'account-balance-wallet',
  cheque_maturity: 'event',
};

/** Reports that summarise the selected period; the rest are point-in-time. */
const PERIOD_REPORTS = new Set<FinancialReportType>(['profit_loss', 'cash_flow', 'cheque_maturity']);

export default function ReportsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const { formatBase, formatBaseCompact } = usePreferredMoney();
  const uid = user?.uid;

  const [period, setPeriod] = useState<MoneyPeriod>('this_month');
  const [exporting, setExporting] = useState<FinancialReportType | null>(null);

  // Every transaction in the report period — uncapped, so a busy year is not truncated.
  const range = useMemo(() => getPeriodRange(period), [period]);
  const txQuery = useFirestoreLiveQuery({
    queryKey: ['transactions', uid, 'range', range.start.getTime(), range.end.getTime()],
    queryFn: () => fetchTransactionsInRange(uid!, range.start, range.end),
    subscribe: (onData, onError) =>
      subscribeTransactionsInRange(uid!, range.start, range.end, onData, onError),
    enabled: !!uid,
  });
  const gemsQuery = useFirestoreLiveQuery({
    queryKey: ['gems', uid],
    queryFn: () => fetchGems(uid!),
    subscribe: (onData, onError) => subscribeGems(uid!, onData, onError),
    enabled: !!uid,
  });
  const recQuery = useFirestoreLiveQuery({
    queryKey: ['receivables', uid, 'open'],
    queryFn: () => fetchOpenReceivables(uid!),
    subscribe: (onData, onError) => subscribeOpenReceivables(uid!, onData, onError),
    enabled: !!uid,
  });
  const payQuery = useFirestoreLiveQuery({
    queryKey: ['payables', uid, 'open'],
    queryFn: () => fetchOpenPayables(uid!),
    subscribe: (onData, onError) => subscribeOpenPayables(uid!, onData, onError),
    enabled: !!uid,
  });
  const chequeQuery = useFirestoreLiveQuery({
    queryKey: ['cheques', uid],
    queryFn: () => fetchCheques(uid!),
    subscribe: (onData, onError) => subscribeCheques(uid!, onData, onError),
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

  const totals = useMemo(
    () => getRangeTotals(reportData.transactions, range),
    [reportData.transactions, range],
  );
  const buckets = useMemo(
    () => getCashFlowBuckets(reportData.transactions, period),
    [reportData.transactions, period],
  );

  const loading =
    txQuery.isLoading ||
    gemsQuery.isLoading ||
    recQuery.isLoading ||
    payQuery.isLoading ||
    chequeQuery.isLoading;

  async function handleExport(type: FinancialReportType) {
    setExporting(type);
    await Promise.resolve()
      .then(async () => {
        const html = buildReportHtml(type, period, reportData);
        const meta = REPORT_TYPES.find((r) => r.id === type);
        await exportReportPdf(html, `GemFort-${meta?.label ?? type}.pdf`);
        toast.success('Report ready to share.');
      })
      .catch((e) => {
        toast.error(friendlyError(e, 'Could not generate PDF.'));
      })
      .finally(() => {
        setExporting(null);
      });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Reports" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset style={styles.lead}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Export financial summaries as PDF to share with your accountant or partners.
          </Text>
          <SegmentedControl
            accessibilityLabel="Report period"
            options={MONEY_PERIODS}
            value={period}
            onChange={setPeriod}
          />
        </ScreenInset>

        <FormSection title={`Preview · ${range.label}`}>
          <KeyStats
            items={[
              { label: 'Income', value: txQuery.isLoading ? '—' : formatBase(totals.income) },
              { label: 'Expenses', value: txQuery.isLoading ? '—' : formatBase(totals.expense) },
              {
                label: 'Net',
                value: txQuery.isLoading
                  ? '—'
                  : `${totals.net < 0 ? '−' : ''}${formatBase(Math.abs(totals.net))}`,
              },
            ]}
          />
          <View style={styles.chart}>
            <CashFlowChart
              buckets={buckets}
              formatAmount={formatBase}
              formatCompact={formatBaseCompact}
              loading={txQuery.isLoading}
            />
          </View>
        </FormSection>

        <FormSection title="Export">
          {REPORT_TYPES.map((report, i) => {
            const busy = exporting === report.id;
            return (
              <Pressable
                key={report.id}
                accessibilityRole="button"
                accessibilityLabel={`Export ${report.label} as PDF`}
                accessibilityState={{ busy, disabled: !!exporting || loading }}
                onPress={() => handleExport(report.id)}
                disabled={!!exporting || loading}
                style={({ pressed }) => [
                  styles.reportRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
                  pressed && { opacity: 0.7 },
                  (loading || (!!exporting && !busy)) && { opacity: 0.5 },
                ]}
              >
                <View style={[styles.reportIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Icon name={REPORT_ICONS[report.id]} size={20} color={colors.onSurface} />
                </View>
                <View style={styles.reportBody}>
                  <Text style={[styles.reportTitle, { color: colors.onSurface }]}>{report.label}</Text>
                  <Text style={[styles.reportSub, { color: colors.textMuted }]}>
                    {report.subtitle}
                    {PERIOD_REPORTS.has(report.id) ? ` · ${range.label}` : ' · as of today'}
                  </Text>
                </View>
                {busy || loading ? (
                  <ActivityIndicator color={colors.onSurface} />
                ) : (
                  <Icon name="ios-share" size={20} color={colors.onSurfaceVariant} />
                )}
              </Pressable>
            );
          })}
        </FormSection>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: Spacing.stackSm, paddingBottom: Spacing.section, gap: Spacing.lg },
  lead: { gap: Spacing.md },
  subtitle: { ...text, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  chart: { marginTop: Spacing.lg },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingVertical: Spacing.md,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBody: { flex: 1, minWidth: 0, gap: 2 },
  reportTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 20 },
  reportSub: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17 },
});
