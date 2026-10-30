import { FlashList } from '@/components/ui/gesture-lists';
import { format, isToday, isYesterday } from 'date-fns';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Accent,
  IconBubble,
  KeyStats,
  ListItem,
  ListSectionHeader,
  TitleBand,
} from '@/components/ui/detail-kit';
import { EmptyState } from '@/components/ui/empty-state';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { StackHeader } from '@/components/ui/stack-header';
import { Spacing } from '@/constants/design-tokens';
import { subscribeContacts } from '@/features/workspace/firestore-subscriptions';
import {
  getPaymentSourceMeta,
  paymentSourceHref,
  sourceOfPayment,
} from '@/features/workspace/payment-source';
import { fetchPaymentsPage } from '@/features/workspace/workspace-pagination';
import { fetchContacts } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreInfiniteQuery } from '@/hooks/use-firestore-infinite-query';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Payment } from '@/types';

type Entry =
  | { kind: 'header'; key: string; title: string; net: number }
  | { kind: 'row'; key: string; item: Payment; isLast: boolean };

function dayTitle(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (date.getFullYear() === new Date().getFullYear()) return format(date, 'EEE, d MMM');
  return format(date, 'd MMM yyyy');
}

function signedBase(p: Payment): number {
  const base = typeof p.amountBase === 'number' ? p.amountBase : 0;
  return p.direction === 'in' ? base : -base;
}

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();

  const {
    items: payments,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ['payments', user?.uid, 'infinite'],
    fetchPage: (cursor, pageSize) =>
      fetchPaymentsPage(user!.uid, cursor, pageSize),
    enabled: !!user,
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

  const { entries, received, paidOut } = useMemo(() => {
    let inTotal = 0;
    let outTotal = 0;
    const groups = new Map<string, { date: Date; items: Payment[] }>();
    for (const p of payments) {
      const base = typeof p.amountBase === 'number' ? p.amountBase : 0;
      if (p.direction === 'in') inTotal += base;
      else outTotal += base;
      const date = p.paymentDate?.toDate?.() ?? new Date(0);
      const key = format(date, 'yyyy-MM-dd');
      const group = groups.get(key) ?? { date, items: [] };
      group.items.push(p);
      groups.set(key, group);
    }
    const list: Entry[] = [];
    for (const [key, group] of Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))) {
      list.push({
        kind: 'header',
        key: `h-${key}`,
        title: dayTitle(group.date),
        net: group.items.reduce((sum, p) => sum + signedBase(p), 0),
      });
      group.items.forEach((item, i) =>
        list.push({ kind: 'row', key: item.id, item, isLast: i === group.items.length - 1 }),
      );
    }
    return { entries: list, received: inTotal, paidOut: outTotal };
  }, [payments]);

  const net = received - paidOut;

  function renderEntry({ item: entry }: { item: Entry }) {
    if (entry.kind === 'header') {
      return (
        <View style={[styles.bandHeader, { backgroundColor: colors.surfaceContainerLowest }]}>
          <ListSectionHeader
            title={entry.title}
            trailing={`${entry.net > 0 ? '+' : entry.net < 0 ? '−' : ''}${formatBase(Math.abs(entry.net))}`}
            trailingColor={entry.net > 0 ? Accent.emerald : undefined}
          />
        </View>
      );
    }

    const { item, isLast } = entry;
    const isIn = item.direction === 'in';
    const source = sourceOfPayment(item);
    const sourceMeta = getPaymentSourceMeta(source?.type);
    const href = source ? paymentSourceHref(source.type, source.id) : null;
    const party = contactName(item.contactId);
    const directionLabel = isIn ? 'Payment received' : 'Payment made';

    return (
      <ListItem
        leading={
          <IconBubble
            icon={isIn ? 'south-west' : 'north-east'}
            accent={isIn ? Accent.emerald : Accent.amber}
            size={40}
          />
        }
        title={party ?? directionLabel}
        subtitle={[party ? directionLabel : null, source ? sourceMeta.label : null, item.paymentMethod]
          .filter(Boolean)
          .join(' · ')}
        meta={[
          formatRelativeTime(item.paymentDate),
          item.commission
            ? `Commission ${formatStored({ amount: item.commission, currency: item.currency })}`
            : null,
          item.notes,
        ]
          .filter(Boolean)
          .join(' · ')}
        amount={`${isIn ? '+' : '−'}${formatStored({
          amount: item.amount,
          currency: item.currency,
          amountBase: item.amountBase,
        })}`}
        amountColor={isIn ? Accent.emerald : undefined}
        onPress={href ? () => router.push(href) : undefined}
        isLast={isLast}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Payment History" />
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
        ListHeaderComponent={
          payments.length > 0 ? (
            <TitleBand
              title={`${net > 0 ? '+' : net < 0 ? '−' : ''}${formatBase(Math.abs(net))}`}
              subtitle={`Net across ${payments.length} payment${payments.length === 1 ? '' : 's'}`}
            >
              <KeyStats
                items={[
                  { label: 'Received', value: formatBase(received), color: Accent.emerald },
                  { label: 'Paid out', value: formatBase(paidOut) },
                  { label: 'Payments', value: String(payments.length) },
                ]}
              />
            </TitleBand>
          ) : null
        }
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={() => void fetchNextPage()}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="payments"
            title="No payments yet"
            subtitle="Partial payments on receivables and payables appear here with commission if recorded."
          />
        }
        renderItem={renderEntry}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingBottom: Spacing.section },
  bandHeader: { marginTop: 8 },
});
