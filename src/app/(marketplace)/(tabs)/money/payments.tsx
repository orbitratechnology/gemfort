import { FlashList } from '@/components/ui/gesture-lists';
import { useFirestoreInfiniteQuery } from '@/hooks/use-firestore-infinite-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  getPaymentSourceMeta,
  paymentSourceHref,
  sourceOfPayment,
} from '@/features/workspace/payment-source';
import { fetchPaymentsPage } from '@/features/workspace/workspace-pagination';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Payment } from '@/types';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();

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

  function renderRow({ item }: { item: Payment }) {
    const isIn = item.direction === 'in';
    const tone = isIn ? colors.successEmerald : colors.error;
    const source = sourceOfPayment(item);
    const sourceMeta = getPaymentSourceMeta(source?.type);
    const href = source ? paymentSourceHref(source.type, source.id) : null;

    return (
      <Pressable
        onPress={() => (href ? router.push(href) : undefined)}
        disabled={!href}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <View style={[styles.icon, { backgroundColor: tone + '1A' }]}>
          <Icon name={isIn ? 'south-west' : 'north-east'} size={18} color={tone} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.onSurface }]}>
              {isIn ? 'Payment received' : 'Payment made'}
            </Text>
            {source ? (
              <View style={[styles.sourceChip, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Icon name={sourceMeta.icon} size={12} color={colors.onSurfaceVariant} />
                <Text style={[styles.sourceText, { color: colors.onSurfaceVariant }]}>
                  {sourceMeta.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {formatRelativeTime(item.paymentDate)}
            {item.paymentMethod ? ` · ${item.paymentMethod}` : ''}
            {item.commission
              ? ` · Commission ${formatStored({
                  amount: item.commission,
                  currency: item.currency,
                })}`
              : ''}
          </Text>
          {item.notes ? (
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
        <View style={styles.amountCol}>
          <Text style={[styles.amount, { color: tone }]}>
            {isIn ? '+' : '−'}
            {formatStored({
              amount: item.amount,
              currency: item.currency,
              amountBase: item.amountBase,
            })}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Payment History" />
      <FlashList
        data={payments}
        keyExtractor={(p) => p.id}
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
        ListEmptyComponent={
          <EmptyState
            icon="payments"
            title="No payments yet"
            subtitle="Partial payments on receivables and payables appear here with commission if recorded."
          />
        }
        renderItem={renderRow}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: Spacing.containerMargin, gap: Spacing.sm, paddingBottom: Spacing.section },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  title: { ...Typography.labelMd, fontWeight: '600' },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  sourceText: { ...Typography.caption, fontWeight: '600' },
  sub: { ...Typography.bodySmall },
  notes: { ...Typography.bodySmall, marginTop: 2 },
  amountCol: { alignItems: 'flex-end', gap: 2 },
  amount: { ...Typography.labelMd, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
