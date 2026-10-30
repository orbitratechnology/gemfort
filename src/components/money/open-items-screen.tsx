import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AgingBar } from '@/components/money/aging-bar';
import { useMoneyChartTheme } from '@/components/money/money-chart-theme';
import { SegmentedControl } from '@/components/money/segmented-control';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import {
  Accent,
  Callout,
  DetailRows,
  IconBubble,
  ListItem,
  ListSectionHeader,
  StatusChip,
  TitleBand,
} from '@/components/ui/detail-kit';
import { EmptyState } from '@/components/ui/empty-state';
import { FlashList } from '@/components/ui/gesture-lists';
import { Icon, type IconName } from '@/components/ui/icon';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { Input } from '@/components/ui/input';
import { ReceiptField } from '@/components/ui/receipt-field';
import { StackHeader } from '@/components/ui/stack-header';
import { resolveCurrencyCode } from '@/constants/currencies';
import { Spacing } from '@/constants/design-tokens';
import {
  subscribeContacts,
  subscribeOpenPayables,
  subscribeOpenReceivables,
} from '@/features/workspace/firestore-subscriptions';
import {
  effectivePayableStatus,
  effectiveReceivableStatus,
} from '@/features/workspace/payment-utils';
import {
  fetchSettledPayablesPage,
  fetchSettledReceivablesPage,
} from '@/features/workspace/workspace-pagination';
import {
  fetchContacts,
  fetchOpenPayables,
  fetchOpenReceivables,
  recordPayablePayment,
  recordReceivablePayment,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreInfiniteQuery } from '@/hooks/use-firestore-infinite-query';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePendingAction } from '@/hooks/use-pending-action';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { friendlyError } from '@/lib/errors';
import { uploadReceipt } from '@/lib/firebase/receipt-service';
import type { LocalMedia } from '@/lib/firebase/storage-service';
import { outstandingBase } from '@/lib/money';
import { formatRelativeDue } from '@/lib/utils';
import { parseForm, recordPaymentSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { Payable, Receivable } from '@/types';

export type OpenItemKind = 'receivable' | 'payable';
type OpenItem = Receivable | Payable;
type Status = OpenItem['status'];
type Bucket = 'overdue' | 'week' | 'later';
type Tab = 'open' | 'settled';

/** Everything that differs between money owed to you and money you owe. */
const KIND = {
  receivable: {
    title: 'Receivables',
    noun: 'receivable',
    chip: 'Owed to you',
    icon: 'south-west' as IconName,
    settledTab: 'Received',
    party: 'From',
    soFar: 'Received so far',
    remaining: 'Remaining to collect',
    partial: 'Part received',
    addHref: '/(marketplace)/money/receivables/add',
    emptyIcon: 'account-balance-wallet' as IconName,
    emptyOpen: 'Nothing to collect',
    emptyOpenHint: 'Money people owe you shows up here until it is paid.',
    withCommission: true,
    queryKey: 'receivables',
  },
  payable: {
    title: 'Payables',
    noun: 'payable',
    chip: 'You owe',
    icon: 'north-east' as IconName,
    settledTab: 'Paid',
    party: 'To',
    soFar: 'Paid so far',
    remaining: 'Remaining to pay',
    partial: 'Part paid',
    addHref: '/(marketplace)/money/payables/add',
    emptyIcon: 'money-off' as IconName,
    emptyOpen: 'Nothing to pay',
    emptyOpenHint: 'Money you owe shows up here until it is settled.',
    withCommission: false,
    queryKey: 'payables',
  },
} as const;

type Entry =
  | { kind: 'header'; key: string; title: string; accent: string; count?: number; trailing: string | null }
  | { kind: 'row'; key: string; item: OpenItem; isLast: boolean };

const round2 = (n: number) => Math.round(n * 100) / 100;

function settledOf(item: OpenItem) {
  return 'amountReceived' in item ? item.amountReceived : item.amountPaid;
}

function remainingOf(item: OpenItem) {
  return Math.max(0, round2(item.amount - settledOf(item)));
}

/** Outstanding in LKR base, so items in different currencies add up correctly. */
function remainingBase(item: OpenItem) {
  return outstandingBase(item.amount, settledOf(item), item.amountBase, item.currency);
}

function statusOf(kind: OpenItemKind, item: OpenItem): Status {
  return kind === 'receivable'
    ? effectiveReceivableStatus(item as Receivable)
    : effectivePayableStatus(item as Payable);
}

/** Days until due (negative when past), or null without a due date. */
function daysUntilDue(item: OpenItem): number | null {
  const due = item.dueDate?.toDate?.();
  if (!due) return null;
  return differenceInCalendarDays(startOfDay(due), startOfDay(new Date()));
}

function bucketOf(kind: OpenItemKind, item: OpenItem): Bucket {
  if (statusOf(kind, item) === 'overdue') return 'overdue';
  const days = daysUntilDue(item);
  return days != null && days <= 6 ? 'week' : 'later';
}

/**
 * Receivables and payables share one screen: an outstanding total with an
 * urgency breakdown, open items grouped by when they fall due, settled history
 * on its own tab, and a sheet to record a full or partial payment.
 */
export function OpenItemsScreen({ kind }: { kind: OpenItemKind }) {
  const cfg = KIND[kind];
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const chart = useMoneyChartTheme();
  const preferred = usePreferredCurrency();
  const { formatBase, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<Tab>('open');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMoney, setPaymentMoney] = useState<CurrencyAmountValue>({ amount: '', currency: preferred });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState<LocalMedia | null>(null);
  const [commission, setCommission] = useState<CurrencyAmountValue>({ amount: '', currency: preferred });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Every open item is loaded live so totals and due buckets are complete;
  // only the settled history is paginated, and only once its tab is opened.
  const openQuery = useFirestoreLiveQuery<OpenItem[]>({
    queryKey: [cfg.queryKey, user?.uid, 'open'],
    queryFn: () => (kind === 'receivable' ? fetchOpenReceivables(user!.uid) : fetchOpenPayables(user!.uid)),
    subscribe: (onData, onError) =>
      kind === 'receivable'
        ? subscribeOpenReceivables(user!.uid, onData, onError)
        : subscribeOpenPayables(user!.uid, onData, onError),
    enabled: !!user,
  });
  const settledQuery = useFirestoreInfiniteQuery<OpenItem>({
    queryKey: [cfg.queryKey, user?.uid, 'settled'],
    fetchPage: (cursor, pageSize) =>
      kind === 'receivable'
        ? fetchSettledReceivablesPage(user!.uid, cursor, pageSize)
        : fetchSettledPayablesPage(user!.uid, cursor, pageSize),
    enabled: !!user && view === 'settled',
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });
  const contactName = useMemo(() => {
    const map = new Map(contacts.map((c) => [c.id, c.displayName?.trim() || null]));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [contacts]);

  const openItems = useMemo(
    () => (openQuery.data ?? []).filter((item) => remainingOf(item) > 0),
    [openQuery.data],
  );
  const settledItems = settledQuery.items;
  const loadingOpen = openQuery.isLoading && !openQuery.data;

  const summary = useMemo(() => {
    const groups: Record<Bucket, OpenItem[]> = { overdue: [], week: [], later: [] };
    for (const item of openItems) groups[bucketOf(kind, item)].push(item);
    const byDue = (a: OpenItem, b: OpenItem) =>
      (daysUntilDue(a) ?? Number.MAX_SAFE_INTEGER) - (daysUntilDue(b) ?? Number.MAX_SAFE_INTEGER);
    groups.overdue.sort(byDue);
    groups.week.sort(byDue);
    groups.later.sort(byDue);
    const sum = (items: OpenItem[]) => items.reduce((s, item) => s + remainingBase(item), 0);
    return {
      groups,
      total: sum(openItems),
      overdue: sum(groups.overdue),
      week: sum(groups.week),
      later: sum(groups.later),
      partial: openItems.filter((item) => statusOf(kind, item) === 'partial').length,
    };
  }, [openItems, kind]);

  const entries = useMemo<Entry[]>(() => {
    if (view === 'settled') {
      return settledItems.map((item, i) => ({
        kind: 'row',
        key: item.id,
        item,
        isLast: i === settledItems.length - 1,
      }));
    }
    const sections: { id: Bucket; title: string; accent: string; total: number }[] = [
      { id: 'overdue', title: 'Overdue', accent: chart.overdue, total: summary.overdue },
      { id: 'week', title: 'Due in 7 days', accent: chart.dueSoon, total: summary.week },
      { id: 'later', title: 'Later', accent: chart.later, total: summary.later },
    ];
    const list: Entry[] = [];
    for (const section of sections) {
      const items = summary.groups[section.id];
      if (items.length === 0) continue;
      list.push({
        kind: 'header',
        key: `h-${section.id}`,
        title: section.title,
        accent: section.accent,
        count: items.length,
        trailing: formatBase(section.total),
      });
      items.forEach((item, i) =>
        list.push({ kind: 'row', key: item.id, item, isLast: i === items.length - 1 }),
      );
    }
    return list;
  }, [view, settledItems, summary, chart, formatBase]);

  const payingItem = payingId ? openItems.find((item) => item.id === payingId) ?? null : null;

  const [recordingPayment, handleRecordPayment] = usePendingAction(async (item: OpenItem) => {
    if (!user) return;
    // No silent default: an empty amount must not settle the whole balance.
    const result = parseForm(recordPaymentSchema, { amount: paymentMoney.amount });
    if (!result.success) {
      setPaymentError(result.errors.amount ?? 'Enter a valid payment amount');
      toast.error(result.errors.amount ?? 'Enter a valid payment amount');
      return;
    }
    setPaymentError(null);
    try {
      const receiptUrl = await uploadReceipt(user.uid, paymentReceipt);
      const options = {
        currency: paymentMoney.currency,
        paymentMethod: paymentMethod || null,
        receiptUrl,
      };
      if (kind === 'receivable') {
        await recordReceivablePayment(user.uid, item.id, result.data.amount, {
          ...options,
          commission: commission.amount ? parseFloat(commission.amount) : null,
        });
      } else {
        await recordPayablePayment(user.uid, item.id, result.data.amount, options);
      }
      await queryClient.invalidateQueries({ queryKey: [cfg.queryKey] });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Payment recorded');
      closeSheet();
    } catch (e) {
      toast.error(friendlyError(e, 'Payment could not be recorded.'));
    }
  });

  function closeSheet() {
    setPayingId(null);
    setPaymentMoney({ amount: '', currency: preferred });
    setPaymentMethod('');
    setCommission({ amount: '', currency: preferred });
    setPaymentReceipt(null);
    setPaymentError(null);
  }

  function remainingStored(item: OpenItem) {
    return { amount: remainingOf(item), currency: item.currency, amountBase: remainingBase(item) };
  }

  function settledStored(item: OpenItem) {
    const settled = settledOf(item);
    return {
      amount: settled,
      currency: item.currency,
      amountBase:
        item.amountBase && item.amount > 0 ? (settled / item.amount) * item.amountBase : undefined,
    };
  }

  function startPayment(item: OpenItem, mode: 'full' | 'partial') {
    const currency = resolveCurrencyCode(item.currency, preferred);
    setPayingId(item.id);
    setPaymentError(null);
    setPaymentMoney({ amount: mode === 'full' ? String(remainingOf(item)) : '', currency });
    if (item.id !== payingId) setCommission({ amount: '', currency });
  }

  // Chips put the accent on text, so they use the kit's ink-safe accents
  // rather than the lighter chart fills.
  function statusChipFor(item: OpenItem): { label: string; accent: string } {
    const status = statusOf(kind, item);
    if (status === 'paid') return { label: cfg.settledTab, accent: Accent.emerald };
    if (status === 'overdue') return { label: 'Overdue', accent: Accent.rose };
    if (status === 'partial') return { label: cfg.partial, accent: Accent.amber };
    return { label: 'Open', accent: Accent.slate };
  }

  function renderEntry({ item: entry }: { item: Entry }) {
    if (entry.kind === 'header') {
      return (
        <View style={[styles.bandHeader, { backgroundColor: colors.surfaceContainerLowest }]}>
          <ListSectionHeader
            title={entry.title}
            count={entry.count}
            accent={entry.accent}
            trailing={entry.trailing}
          />
        </View>
      );
    }

    const { item, isLast } = entry;
    const settled = statusOf(kind, item) === 'paid' || remainingOf(item) <= 0;
    const party = contactName(item.contactId);
    const what = item.title || item.description || cfg.title.slice(0, -1);
    const settledSoFar = settledOf(item);

    return (
      <ListItem
        leading={<IconBubble icon={cfg.icon} accent={settled ? chart.income : chart.later} size={40} />}
        title={party ?? what}
        subtitle={party ? what : null}
        meta={
          settled
            ? `Total ${formatStored({ amount: item.amount, currency: item.currency, amountBase: item.amountBase })}`
            : [
                `Due ${formatRelativeDue(item.dueDate)}`,
                settledSoFar > 0 ? `${cfg.settledTab} ${formatStored(settledStored(item))}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        amount={
          settled
            ? formatStored({ amount: item.amount, currency: item.currency, amountBase: item.amountBase })
            : formatStored(remainingStored(item))
        }
        status={statusChipFor(item)}
        onPress={settled ? undefined : () => startPayment(item, 'full')}
        isLast={isLast}
      />
    );
  }

  const sheetRemaining = payingItem ? remainingOf(payingItem) : 0;
  const sheetStatus = payingItem ? statusOf(kind, payingItem) : null;
  const sheetParty = payingItem ? contactName(payingItem.contactId) : null;
  const sheetMode = paymentMoney.amount === String(sheetRemaining) ? 'full' : 'partial';
  const openCount = openItems.length;

  const header = (
    <View>
      <TitleBand
        fitTitle
        chips={<StatusChip label={cfg.chip} accent={kind === 'receivable' ? Accent.emerald : Accent.amber} />}
        title={loadingOpen ? '—' : formatBase(summary.total)}
        subtitle={
          loadingOpen
            ? 'Loading…'
            : openCount === 0
              ? 'Everything is settled'
              : `Outstanding across ${openCount} open ${cfg.noun}${openCount === 1 ? '' : 's'}${
                  summary.partial > 0 ? ` · ${summary.partial} ${cfg.partial.toLowerCase()}` : ''
                }`
        }
      >
        {openCount > 0 ? (
          <View style={styles.aging}>
            <AgingBar
              formatAmount={formatBase}
              segments={[
                {
                  key: 'overdue',
                  label: 'Overdue',
                  amount: summary.overdue,
                  count: summary.groups.overdue.length,
                  color: chart.overdue,
                },
                {
                  key: 'week',
                  label: 'Due in 7 days',
                  amount: summary.week,
                  count: summary.groups.week.length,
                  color: chart.dueSoon,
                },
                {
                  key: 'later',
                  label: 'Later or no date',
                  amount: summary.later,
                  count: summary.groups.later.length,
                  color: chart.later,
                },
              ]}
            />
          </View>
        ) : null}
      </TitleBand>
      <View style={[styles.tabs, { backgroundColor: colors.surfaceContainerLowest }]}>
        <SegmentedControl
          accessibilityLabel={`${cfg.title} view`}
          options={[
            { id: 'open', label: openCount > 0 ? `Open · ${openCount}` : 'Open' },
            { id: 'settled', label: cfg.settledTab },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader
        title={cfg.title}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Payment history"
            onPress={() => router.push('/(marketplace)/(tabs)/money/payments' as Href)}
            hitSlop={8}
          >
            <Icon name="history" size={24} color={colors.onSurface} />
          </Pressable>
        }
      />
      <FlashList
        data={entries}
        keyExtractor={(e) => e.key}
        getItemType={(e) => e.kind}
        onRefresh={() => {
          void openQuery.refetch();
          if (view === 'settled') void settledQuery.refetch();
        }}
        refreshing={openQuery.isRefetching || (view === 'settled' && settledQuery.isRefetching)}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (view === 'settled' && settledQuery.hasNextPage && !settledQuery.isFetchingNextPage) {
            void settledQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={header}
        ListFooterComponent={
          view === 'settled' ? (
            <InfiniteListFooter
              hasNextPage={settledQuery.hasNextPage}
              isFetchingNextPage={settledQuery.isFetchingNextPage}
              isFetchNextPageError={settledQuery.isFetchNextPageError}
              onRetry={() => void settledQuery.fetchNextPage()}
            />
          ) : null
        }
        ListEmptyComponent={
          (view === 'open' && loadingOpen) || (view === 'settled' && settledQuery.isLoading) ? null : (
            <EmptyState
              icon={cfg.emptyIcon}
              title={view === 'open' ? cfg.emptyOpen : `No ${cfg.settledTab.toLowerCase()} ${cfg.noun}s yet`}
              subtitle={view === 'open' ? cfg.emptyOpenHint : `Fully settled ${cfg.noun}s move here.`}
            />
          )
        }
        renderItem={renderEntry}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${cfg.noun}`}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push(cfg.addHref as Href)}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>

      <BottomSheet
        visible={payingItem != null}
        onClose={() => {
          if (!recordingPayment) closeSheet();
        }}
        title="Record payment"
        footer={
          payingItem ? (
            <>
              <Button
                title="Confirm Payment"
                icon="check-circle"
                loading={recordingPayment}
                onPress={() => handleRecordPayment(payingItem)}
              />
              <Button title="Cancel" variant="ghost" disabled={recordingPayment} onPress={closeSheet} />
            </>
          ) : null
        }
      >
        {payingItem ? (
          <>
            <View>
              <DetailRows
                rows={[
                  {
                    key: 'for',
                    icon: 'notes',
                    label: 'For',
                    value: payingItem.title || payingItem.description || cfg.title.slice(0, -1),
                  },
                  ...(sheetParty
                    ? [{ key: 'party', icon: 'person' as const, label: cfg.party, value: sheetParty }]
                    : []),
                  {
                    key: 'due',
                    icon: 'event',
                    accent: sheetStatus === 'overdue' ? chart.overdue : undefined,
                    label: 'Due',
                    value: formatRelativeDue(payingItem.dueDate),
                  },
                  ...(settledOf(payingItem) > 0
                    ? [
                        {
                          key: 'total',
                          icon: 'receipt-long' as const,
                          label: 'Total',
                          value: formatStored({
                            amount: payingItem.amount,
                            currency: payingItem.currency,
                            amountBase: payingItem.amountBase,
                          }),
                        },
                        {
                          key: 'paid',
                          icon: 'check-circle' as const,
                          accent: chart.income,
                          label: cfg.soFar,
                          value: formatStored(settledStored(payingItem)),
                        },
                      ]
                    : []),
                ]}
              />
              <Callout
                icon="account-balance-wallet"
                accent={sheetStatus === 'overdue' ? chart.overdue : colors.onSurface}
                label={cfg.remaining}
                value={formatStored(remainingStored(payingItem))}
                pill={sheetStatus === 'overdue' ? 'Overdue' : null}
              />
            </View>

            <SegmentedControl
              accessibilityLabel="Payment type"
              disabled={recordingPayment}
              options={[
                { id: 'full', label: 'Full payment' },
                { id: 'partial', label: 'Partial' },
              ]}
              value={sheetMode}
              onChange={(mode) => startPayment(payingItem, mode)}
            />

            <CurrencyAmountField
              label="Payment amount"
              value={paymentMoney}
              onChange={(next) => {
                setPaymentMoney(next);
                setPaymentError(null);
              }}
              placeholder={String(sheetRemaining)}
              error={paymentError ?? undefined}
            />
            <Input
              label="Payment method"
              value={paymentMethod}
              onChangeText={setPaymentMethod}
              placeholder="Cash, transfer…"
              leftIcon="account-balance-wallet"
            />
            <ReceiptField value={paymentReceipt} onChange={setPaymentReceipt} />
            {cfg.withCommission ? (
              <CurrencyAmountField
                label="Commission (optional)"
                value={commission}
                onChange={setCommission}
              />
            ) : null}
          </>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingBottom: Spacing.section + 72 },
  bandHeader: { marginTop: 8 },
  aging: { marginTop: Spacing.lg },
  tabs: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.lg,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.28)',
  },
});
