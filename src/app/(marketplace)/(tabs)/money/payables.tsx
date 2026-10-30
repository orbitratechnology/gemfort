import { FlashList } from '@/components/ui/gesture-lists';
import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  KeyStats,
  ListItem,
  ListSectionHeader,
  StatusChip,
  TitleBand,
} from '@/components/ui/detail-kit';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { Input } from '@/components/ui/input';
import { ReceiptField } from '@/components/ui/receipt-field';
import { StackHeader } from '@/components/ui/stack-header';
import { resolveCurrencyCode } from '@/constants/currencies';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import {
  subscribeContacts,
  subscribeOpenPayables,
} from '@/features/workspace/firestore-subscriptions';
import { effectivePayableStatus, getPayableSummary } from '@/features/workspace/payment-utils';
import {
  fetchContacts,
  fetchOpenPayables,
  recordPayablePayment,
} from '@/features/workspace/workspace-service';
import { fetchSettledPayablesPage } from '@/features/workspace/workspace-pagination';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreInfiniteQuery } from '@/hooks/use-firestore-infinite-query';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { usePendingAction } from '@/hooks/use-pending-action';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { friendlyError } from '@/lib/errors';
import { uploadReceipt } from '@/lib/firebase/receipt-service';
import type { LocalMedia } from '@/lib/firebase/storage-service';
import { outstandingBase } from '@/lib/money';
import { formatRelativeDue } from '@/lib/utils';
import { parseForm, recordPaymentSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { Payable } from '@/types';

type Bucket = 'overdue' | 'week' | 'later' | 'settled';

const BUCKETS: { id: Bucket; title: string; accent: string }[] = [
  { id: 'overdue', title: 'Overdue', accent: Accent.rose },
  { id: 'week', title: 'Due this week', accent: Accent.amber },
  { id: 'later', title: 'Later', accent: Accent.slate },
  { id: 'settled', title: 'Paid', accent: Accent.emerald },
];

const STATUS_ACCENT: Record<Payable['status'], string> = {
  overdue: Accent.rose,
  paid: Accent.emerald,
  partial: Accent.amber,
  pending: Accent.amber,
};

type Entry =
  | { kind: 'header'; key: string; title: string; accent: string; count?: number; trailing: string | null }
  | { kind: 'row'; key: string; item: Payable; isLast: boolean };

function remainingOf(item: Payable) {
  return Math.max(0, item.amount - item.amountPaid);
}

/** Days until due (negative when past), or null without a due date. */
function daysUntilDue(item: Payable): number | null {
  const due = item.dueDate?.toDate?.();
  if (!due) return null;
  return differenceInCalendarDays(startOfDay(due), startOfDay(new Date()));
}

function bucketOf(item: Payable): Bucket {
  const status = effectivePayableStatus(item);
  if (status === 'paid') return 'settled';
  if (status === 'overdue') return 'overdue';
  const days = daysUntilDue(item);
  return days != null && days <= 6 ? 'week' : 'later';
}

export default function PayablesScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const { formatBase, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMoney, setPaymentMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState<LocalMedia | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Every open item is loaded live so totals and due buckets are complete;
  // only the settled history is paginated.
  const openQuery = useFirestoreLiveQuery({
    queryKey: ['payables', user?.uid, 'open'],
    queryFn: () => fetchOpenPayables(user!.uid),
    subscribe: (onData, onError) => subscribeOpenPayables(user!.uid, onData, onError),
    enabled: !!user,
  });
  const {
    items: settled,
    refetch: refetchSettled,
    isRefetching: isRefetchingSettled,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ['payables', user?.uid, 'settled'],
    fetchPage: (cursor, pageSize) =>
      fetchSettledPayablesPage(user!.uid, cursor, pageSize),
    enabled: !!user,
  });
  const payables = useMemo(() => {
    const open = openQuery.data ?? [];
    const openIds = new Set(open.map((item) => item.id));
    return [...open, ...settled.filter((item) => !openIds.has(item.id))];
  }, [openQuery.data, settled]);
  const refetch = () => {
    void openQuery.refetch();
    void refetchSettled();
  };
  const isRefetching = openQuery.isRefetching || isRefetchingSettled;

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

  const summary = getPayableSummary(payables);

  const { entries, dueThisWeek, dueThisWeekCount, openCount } = useMemo(() => {
    const groups: Record<Bucket, Payable[]> = { overdue: [], week: [], later: [], settled: [] };
    for (const p of payables) groups[bucketOf(p)].push(p);
    const byDue = (a: Payable, b: Payable) =>
      (daysUntilDue(a) ?? Number.MAX_SAFE_INTEGER) - (daysUntilDue(b) ?? Number.MAX_SAFE_INTEGER);
    groups.overdue.sort(byDue);
    groups.week.sort(byDue);
    groups.later.sort(byDue);

    const list: Entry[] = [];
    for (const bucket of BUCKETS) {
      const items = groups[bucket.id];
      if (items.length === 0) continue;
      const open = items.reduce((sum, p) => sum + remainingOf(p), 0);
      list.push({
        kind: 'header',
        key: `h-${bucket.id}`,
        title: bucket.title,
        accent: bucket.accent,
        // Settled history is paginated, so its count is only known once fully loaded.
        count: bucket.id === 'settled' && hasNextPage ? undefined : items.length,
        trailing: bucket.id === 'settled' ? null : formatBase(open),
      });
      items.forEach((item, i) =>
        list.push({ kind: 'row', key: item.id, item, isLast: i === items.length - 1 }),
      );
    }
    return {
      entries: list,
      dueThisWeek: groups.week.reduce((sum, p) => sum + remainingOf(p), 0),
      dueThisWeekCount: groups.week.length,
      openCount: payables.length - groups.settled.length,
    };
  }, [payables, formatBase, hasNextPage]);

  const payingItem = payingId ? payables.find((p) => p.id === payingId) ?? null : null;

  const [recordingPayment, handleRecordPayment] = usePendingAction(async (item: Payable) => {
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
      await recordPayablePayment(user.uid, item.id, result.data.amount, {
        currency: paymentMoney.currency,
        paymentMethod: paymentMethod || null,
        receiptUrl,
      });
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Payment recorded');
      setPayingId(null);
      setPaymentMoney({ amount: '', currency: preferred });
      setPaymentMethod('');
      setPaymentReceipt(null);
    } catch (e) {
      toast.error(friendlyError(e, 'Payment could not be recorded.'));
    }
  });

  function payableRemainingStored(item: Payable) {
    const remaining = item.amount - item.amountPaid;
    return {
      amount: remaining,
      currency: item.currency,
      amountBase: outstandingBase(
        item.amount,
        item.amountPaid,
        item.amountBase,
        item.currency,
      ),
    };
  }

  function paidStored(item: Payable) {
    return {
      amount: item.amountPaid,
      currency: item.currency,
      amountBase:
        item.amountBase && item.amount > 0
          ? (item.amountPaid / item.amount) * item.amountBase
          : undefined,
    };
  }

  function startPayment(item: Payable, mode: 'full' | 'partial') {
    const remaining = Math.round((item.amount - item.amountPaid) * 100) / 100;
    setPayingId(item.id);
    setPaymentMoney({
      amount: mode === 'full' ? String(remaining) : '',
      currency: resolveCurrencyCode(item.currency, preferred),
    });
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
    const status = effectivePayableStatus(item);
    const paid = status === 'paid';
    const party = contactName(item.contactId);
    const what = item.title || item.description || 'Payable';

    return (
      <ListItem
        leading={<IconBubble icon="north-east" accent={paid ? Accent.emerald : Accent.amber} size={40} />}
        title={party ?? what}
        subtitle={party ? what : null}
        meta={[
          `Due ${formatRelativeDue(item.dueDate)}`,
          item.amountPaid > 0 ? `Paid ${formatStored(paidStored(item))}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        amount={
          paid
            ? formatStored({ amount: item.amount, currency: item.currency, amountBase: item.amountBase })
            : formatStored(payableRemainingStored(item))
        }
        amountColor={paid ? Accent.emerald : status === 'overdue' ? Accent.rose : undefined}
        status={{ label: status, accent: STATUS_ACCENT[status] }}
        onPress={paid ? undefined : () => startPayment(item, 'full')}
        isLast={isLast}
      />
    );
  }

  const sheetRemaining = payingItem
    ? Math.round((payingItem.amount - payingItem.amountPaid) * 100) / 100
    : 0;
  const sheetStatus = payingItem ? effectivePayableStatus(payingItem) : null;
  const sheetParty = payingItem ? contactName(payingItem.contactId) : null;
  const sheetMode = paymentMoney.amount === String(sheetRemaining) ? 'full' : 'partial';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader
        title="Payables"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Payment history"
            onPress={() => router.push('/(marketplace)/(tabs)/money/payments' as never)}
            hitSlop={8}
          >
            <Icon name="history" size={24} color={colors.primary} />
          </Pressable>
        }
      />
      <FlashList
        data={entries}
        keyExtractor={(e) => e.key}
        getItemType={(e) => e.kind}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={() => void fetchNextPage()}
          />
        }
        ListHeaderComponent={
          <TitleBand
            chips={<StatusChip label="You owe" accent={Accent.amber} />}
            title={formatBase(summary.totalOutstanding)}
            subtitle={`Outstanding across ${openCount} open payable${openCount === 1 ? '' : 's'}`}
          >
            <KeyStats
              items={[
                {
                  label: 'Due this week',
                  value: formatBase(dueThisWeek),
                  sub: `${dueThisWeekCount} item${dueThisWeekCount === 1 ? '' : 's'}`,
                  color: dueThisWeekCount > 0 ? Accent.amber : undefined,
                },
                {
                  label: 'Overdue',
                  value: formatBase(summary.overdueAmount),
                  sub: `${summary.overdueCount} item${summary.overdueCount === 1 ? '' : 's'}`,
                  color: summary.overdueCount > 0 ? Accent.rose : undefined,
                },
                {
                  label: 'Partly paid',
                  value: String(summary.partialCount),
                  sub: 'in progress',
                },
              ]}
            />
            {summary.overdueCount > 0 ? (
              <Callout
                icon="warning"
                accent={Accent.rose}
                label={`${summary.overdueCount} overdue payable${summary.overdueCount === 1 ? '' : 's'}`}
                value={formatBase(summary.overdueAmount)}
                pill="Overdue"
              />
            ) : null}
          </TitleBand>
        }
        ListEmptyComponent={<EmptyState icon="money-off" title="No payables" subtitle="Track money you owe here." />}
        renderItem={renderEntry}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add payable"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push('/(marketplace)/money/payables/add' as never)}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>

      <BottomSheet
        visible={payingItem != null}
        onClose={() => {
          if (!recordingPayment) setPayingId(null);
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
              <Button
                title="Cancel"
                variant="ghost"
                disabled={recordingPayment}
                onPress={() => setPayingId(null)}
              />
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
                    value: payingItem.title || payingItem.description || 'Payable',
                  },
                  ...(sheetParty
                    ? [{ key: 'party', icon: 'person' as const, label: 'To', value: sheetParty }]
                    : []),
                  {
                    key: 'due',
                    icon: 'event',
                    accent: sheetStatus === 'overdue' ? Accent.rose : undefined,
                    label: 'Due',
                    value: formatRelativeDue(payingItem.dueDate),
                  },
                  ...(payingItem.amountPaid > 0
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
                          accent: Accent.emerald,
                          label: 'Paid so far',
                          value: formatStored(paidStored(payingItem)),
                        },
                      ]
                    : []),
                ]}
              />
              <Callout
                icon="account-balance-wallet"
                accent={sheetStatus === 'overdue' ? Accent.rose : Accent.amber}
                label="Remaining to pay"
                value={formatStored(payableRemainingStored(payingItem))}
                pill={sheetStatus === 'overdue' ? 'Overdue' : null}
              />
            </View>

            <View
              style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}
              accessibilityRole="radiogroup"
            >
              {(
                [
                  { id: 'full', label: 'Full payment' },
                  { id: 'partial', label: 'Partial' },
                ] as const
              ).map((opt) => {
                const active = sheetMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    disabled={recordingPayment}
                    onPress={() => startPayment(payingItem, opt.id)}
                    style={[
                      styles.segmentBtn,
                      active && { backgroundColor: colors.surfaceContainerLowest },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: active ? colors.onSurface : colors.onSurfaceVariant },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontFamily: FontFamily.semibold, fontSize: 14, includeFontPadding: false },
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
