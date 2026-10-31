import { format } from 'date-fns';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SHEET_CLOSE_MS } from '@/components/scan/scan-to-add-row';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Accent, KeyStats, StatusChip } from '@/components/ui/detail-kit';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/design-tokens';
import { toDate } from '@/features/workspace/cheque-utils';
import type { ChequeOutlook, StockPosition, StoneSales } from '@/features/workspace/money-insights';
import { SLOW_MOVER_DAYS } from '@/features/workspace/money-insights';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatRelativeDue } from '@/lib/utils';

import { ShareBars } from './share-bars';

export type MoneyInsight = 'sales' | 'stock' | 'cheques';

const WORKSPACE = '/(marketplace)/(tabs)/workspace';

const TITLE: Record<MoneyInsight, string> = {
  sales: 'Stones sold',
  stock: 'Stock position',
  cheques: 'Cheques · next 30 days',
};

/**
 * Detail behind a Money insight tile. Rows open the stone or cheque; the
 * footer jumps to the full module. Opening anything closes the sheet first.
 */
export function MoneyInsightSheet({
  insight,
  onClose,
  periodLabel,
  sales,
  stock,
  cheques,
  contactName,
  formatAmount,
}: {
  insight: MoneyInsight | null;
  onClose: () => void;
  periodLabel: string;
  sales: StoneSales;
  stock: StockPosition;
  cheques: ChequeOutlook;
  contactName: (id: string | null) => string | null;
  formatAmount: (amountBase: number) => string;
}) {
  const { colors } = useAppTheme();

  function open(href: Href) {
    onClose();
    setTimeout(() => router.push(href), SHEET_CLOSE_MS);
  }

  const footer =
    insight === 'cheques' ? (
      <Button
        title="Open cheque calendar"
        icon="calendar-month"
        variant="secondary"
        onPress={() => open(`${WORKSPACE}/cheques/calendar` as Href)}
      />
    ) : insight ? (
      <Button
        title="Open gem inventory"
        icon="diamond"
        variant="secondary"
        onPress={() => open(`${WORKSPACE}/gems` as Href)}
      />
    ) : undefined;

  return (
    <BottomSheet
      visible={insight != null}
      onClose={onClose}
      title={insight ? TITLE[insight] : undefined}
      footer={footer}
    >
      {insight === 'sales' ? (
        <View style={styles.section}>
          <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
            {sales.count === 0
              ? `No stones sold ${periodLabel.toLowerCase()}.`
              : `${sales.count} stone${sales.count === 1 ? '' : 's'} sold ${periodLabel.toLowerCase()}${
                  sales.avgDaysHeld != null ? `, held ${sales.avgDaysHeld} days on average` : ''
                }.`}
          </Text>
          {sales.count > 0 ? (
            <KeyStats
              items={[
                { label: 'Sold for', value: formatAmount(sales.revenue) },
                { label: 'Cost', value: formatAmount(sales.cost) },
                {
                  label: 'Margin',
                  value: sales.marginPct == null ? '—' : `${Math.round(sales.marginPct)}%`,
                  sub: `${sales.profit < 0 ? '−' : ''}${formatAmount(Math.abs(sales.profit))}`,
                  color: sales.profit < 0 ? Accent.rose : Accent.emerald,
                },
              ]}
            />
          ) : null}
          {sales.stones.map((stone, i) => (
            <SheetRow
              key={stone.id}
              first={i === 0}
              title={stone.label}
              subtitle={[
                `${stone.weight}ct ${stone.gemType.replace(/_/g, ' ')}`,
                stone.buyer ? `to ${stone.buyer}` : null,
                format(stone.soldDate, 'd MMM'),
              ]
                .filter(Boolean)
                .join(' · ')}
              amount={formatAmount(stone.revenue)}
              chip={
                stone.marginPct == null
                  ? null
                  : {
                      label: `${stone.profit < 0 ? '' : '+'}${Math.round(stone.marginPct)}%`,
                      accent: stone.profit < 0 ? Accent.rose : Accent.emerald,
                    }
              }
              onPress={() => open(`${WORKSPACE}/gems/${stone.id}` as Href)}
            />
          ))}
        </View>
      ) : null}

      {insight === 'stock' ? (
        <View style={styles.section}>
          <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
            {stock.count === 0
              ? 'No stones in stock.'
              : `${stock.count} stone${stock.count === 1 ? '' : 's'} in stock, valued at cost.`}
          </Text>
          {stock.count > 0 ? (
            <KeyStats
              items={[
                { label: 'At cost', value: formatAmount(stock.cost) },
                {
                  label: 'Asking',
                  value: stock.pricedCount > 0 ? formatAmount(stock.askingTotal) : '—',
                  sub: `${stock.pricedCount} of ${stock.count} priced`,
                },
                {
                  label: 'Markup',
                  value:
                    stock.pricedCost > 0
                      ? `${Math.round(((stock.askingTotal - stock.pricedCost) / stock.pricedCost) * 100)}%`
                      : '—',
                  sub: 'on priced stones',
                },
              ]}
            />
          ) : null}
          <Text style={[styles.heading, { color: colors.textMuted }]}>WHERE IT IS</Text>
          <ShareBars
            formatAmount={formatAmount}
            rows={stock.places
              .filter((p) => p.count > 0)
              .map((p) => ({
              key: p.key,
              label: p.label,
              detail: `${p.count} stone${p.count === 1 ? '' : 's'}`,
              amount: p.cost,
            }))}
          />
          {stock.oldest.length > 0 ? (
            <>
              <Text style={[styles.heading, { color: colors.textMuted }]}>
                SLOW MOVERS · {SLOW_MOVER_DAYS}+ DAYS
              </Text>
              {stock.oldest.map((gem, i) => (
                <SheetRow
                  key={gem.id}
                  first={i === 0}
                  title={gem.label}
                  subtitle={`Held ${gem.days} days`}
                  amount={formatAmount(gem.cost)}
                  onPress={() => open(`${WORKSPACE}/gems/${gem.id}` as Href)}
                />
              ))}
              {stock.slowMovers.count > stock.oldest.length ? (
                <Text style={[styles.more, { color: colors.textMuted }]}>
                  +{stock.slowMovers.count - stock.oldest.length} more held over {SLOW_MOVER_DAYS} days
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {insight === 'cheques' ? (
        <View style={styles.section}>
          <KeyStats
            items={[
              {
                label: 'Coming in',
                value: formatAmount(cheques.incoming.amount),
                sub: `${cheques.incoming.count} cheque${cheques.incoming.count === 1 ? '' : 's'}`,
                color: Accent.emerald,
              },
              {
                label: 'Going out',
                value: formatAmount(cheques.outgoing.amount),
                sub: `${cheques.outgoing.count} cheque${cheques.outgoing.count === 1 ? '' : 's'}`,
              },
            ]}
          />
          {cheques.readyToDeposit > 0 ? (
            <View style={[styles.notice, { backgroundColor: `${Accent.amber}14` }]}>
              <Icon name="account-balance" size={18} color={Accent.amber} />
              <Text style={[styles.noticeText, { color: colors.onSurface }]}>
                {cheques.readyToDeposit} received cheque{cheques.readyToDeposit === 1 ? ' is' : 's are'} past
                {cheques.readyToDeposit === 1 ? ' its' : ' their'} date — ready to deposit.
              </Text>
            </View>
          ) : null}
          {cheques.upcoming.length === 0 ? (
            <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
              No pending cheques in the next 30 days.
            </Text>
          ) : null}
          {cheques.upcoming.map((cheque, i) => {
            const incoming = cheque.direction === 'received';
            const party = contactName(cheque.counterpartyContactId);
            const due = toDate(cheque.maturityDate);
            return (
              <SheetRow
                key={cheque.id}
                first={i === 0}
                title={party ?? cheque.bankName}
                subtitle={[
                  party ? cheque.bankName : null,
                  `#${cheque.chequeNumber}`,
                  due ? formatRelativeDue(due) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                amount={`${incoming ? '+' : '−'}${formatAmount(cheque.amountBase ?? 0)}`}
                chip={{ label: incoming ? 'In' : 'Out', accent: incoming ? Accent.emerald : Accent.amber }}
                onPress={() => open(`${WORKSPACE}/cheques/${cheque.id}` as Href)}
              />
            );
          })}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function SheetRow({
  title,
  subtitle,
  amount,
  chip,
  first,
  onPress,
}: {
  title: string;
  subtitle: string;
  amount: string;
  chip?: { label: string; accent: string } | null;
  first?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}, ${amount}${chip ? `, ${chip.label}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.rowTrailing}>
        <Text
          style={[styles.rowAmount, { color: colors.onSurface }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {amount}
        </Text>
        {chip ? <StatusChip label={chip.label} accent={chip.accent} size="sm" /> : null}
      </View>
    </Pressable>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  lead: { ...text, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  heading: {
    ...text,
    marginTop: Spacing.md,
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    letterSpacing: 1,
  },
  more: { ...text, fontFamily: FontFamily.regular, fontSize: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  noticeText: { ...text, flex: 1, fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  rowSub: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  rowTrailing: { alignItems: 'flex-end', gap: 6, maxWidth: '45%' },
  rowAmount: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
});
