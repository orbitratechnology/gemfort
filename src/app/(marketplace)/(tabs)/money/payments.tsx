import { FlashList } from '@/components/ui/gesture-lists';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { fetchPayments } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Payment } from '@/types';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();

  const { data: payments = [], refetch, isRefetching } = useQuery({
    queryKey: ['payments', user?.uid],
    queryFn: () => fetchPayments(user!.uid),
    enabled: !!user,
  });

  function renderRow({ item }: { item: Payment }) {
    const isIn = item.direction === 'in';
    const tone = isIn ? colors.successEmerald : colors.error;

    return (
      <View style={[styles.row, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
        <View style={[styles.icon, { backgroundColor: tone + '1A' }]}>
          <Icon name={isIn ? 'south-west' : 'north-east'} size={18} color={tone} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.onSurface }]}>
            {isIn ? 'Payment received' : 'Payment made'}
          </Text>
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
      </View>
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
  title: { ...Typography.labelMd, fontWeight: '600' },
  sub: { ...Typography.bodySmall },
  notes: { ...Typography.bodySmall, marginTop: 2 },
  amountCol: { alignItems: 'flex-end', gap: 2 },
  amount: { ...Typography.labelMd, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
