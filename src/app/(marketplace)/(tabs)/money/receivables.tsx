import { FlashList } from '@/components/ui/gesture-lists';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ReceiptField } from '@/components/ui/receipt-field';
import { StackHeader } from '@/components/ui/stack-header';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveCurrencyCode } from '@/constants/currencies';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  effectiveReceivableStatus,
  getReceivableSummary,
} from '@/features/workspace/payment-utils';
import { subscribeReceivables } from '@/features/workspace/firestore-subscriptions';
import {
  fetchReceivables,
  recordReceivablePayment,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { outstandingBase } from '@/lib/money';
import { formatRelativeDue } from '@/lib/utils';
import { parseForm, recordPaymentSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';
import { uploadReceipt } from '@/lib/firebase/receipt-service';
import type { LocalMedia } from '@/lib/firebase/storage-service';
import type { Receivable } from '@/types';

export default function ReceivablesScreen() {
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
  const [commission, setCommission] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: receivables = [], refetch, isRefetching } = useFirestoreLiveQuery({
    queryKey: ['receivables', user?.uid],
    queryFn: () => fetchReceivables(user!.uid),
    subscribe: (onData, onError) => subscribeReceivables(user!.uid, onData, onError),
    enabled: !!user,
  });

  const summary = getReceivableSummary(receivables);
  const overdueItems = receivables.filter(
    (r) => effectiveReceivableStatus(r) === 'overdue',
  );

  async function handleRecordPayment(item: Receivable) {
    if (!user) return;
    const remaining = item.amount - item.amountReceived;
    const amountToValidate = paymentMoney.amount || String(remaining);
    const result = parseForm(recordPaymentSchema, { amount: amountToValidate });
    if (!result.success) {
      setPaymentError(result.errors.amount ?? 'Enter a valid payment amount');
      toast.error(result.errors.amount ?? 'Enter a valid payment amount');
      return;
    }
    setPaymentError(null);
    try {
      await withLoading(async () => {
        const receiptUrl = await uploadReceipt(user.uid, paymentReceipt);
        await recordReceivablePayment(user.uid, item.id, result.data.amount, {
          currency: paymentMoney.currency,
          paymentMethod: paymentMethod || null,
          commission: commission.amount ? parseFloat(commission.amount) : null,
          receiptUrl,
        });
        await queryClient.invalidateQueries({ queryKey: ['receivables'] });
        await queryClient.invalidateQueries({ queryKey: ['payments'] });
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });
        toast.success('Payment recorded');
        setPayingId(null);
        setPaymentMoney({ amount: '', currency: preferred });
        setPaymentMethod('');
        setCommission({ amount: '', currency: preferred });
        setPaymentReceipt(null);
      }, 'Recording payment…');
    } catch (e) {
      toast.error(friendlyError(e, 'Payment could not be recorded.'));
    }
  }

  function receivableRemainingStored(item: Receivable) {
    const remaining = item.amount - item.amountReceived;
    return {
      amount: remaining,
      currency: item.currency,
      amountBase: outstandingBase(
        item.amount,
        item.amountReceived,
        item.amountBase,
        item.currency,
      ),
    };
  }

  function renderRow({ item }: { item: Receivable }) {
    const remaining = item.amount - item.amountReceived;
    const remainingStored = receivableRemainingStored(item);
    const status = effectiveReceivableStatus(item);
    const isPaying = payingId === item.id;
    const paid = status === 'paid';
    const isOverdue = status === 'overdue';

    return (
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surfaceContainerLowest },
          isOverdue && { borderWidth: 1, borderColor: colors.error + '55' },
        ]}>
        <View style={styles.rowHeader}>
          <Text style={[styles.amount, { color: paid ? colors.successEmerald : isOverdue ? colors.error : colors.primary }]}>
            {formatStored(remainingStored)}
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isOverdue
                  ? colors.error + '1A'
                  : paid
                    ? colors.successEmerald + '1A'
                    : colors.warningAmber + '1A',
              },
            ]}>
            <Text
              style={[
                styles.statusText,
                {
                  color: isOverdue ? colors.error : paid ? colors.successEmerald : colors.warningAmber,
                },
              ]}>
              {status}
            </Text>
          </View>
        </View>
        <Text style={[styles.desc, { color: colors.onSurface }]}>
          {item.title || item.description || "Receivable"}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Due {formatRelativeDue(item.dueDate)}
          {item.amountReceived > 0
            ? ` · Received ${formatStored({
                amount: item.amountReceived,
                currency: item.currency,
                amountBase:
                  item.amountBase && item.amount > 0
                    ? (item.amountReceived / item.amount) * item.amountBase
                    : undefined,
              })}`
            : ''}
        </Text>
        {!paid ? (
          isPaying ? (
            <View style={styles.payForm}>
              <CurrencyAmountField
                label="Payment amount"
                value={paymentMoney}
                onChange={(next) => {
                  setPaymentMoney(next);
                  setPaymentError(null);
                }}
                placeholder={String(remaining)}
                error={paymentError ?? undefined}
              />
              <Input label="Payment method" value={paymentMethod} onChangeText={setPaymentMethod} placeholder="Cash, transfer…" leftIcon="account-balance-wallet" />
              <ReceiptField value={paymentReceipt} onChange={setPaymentReceipt} />
              <CurrencyAmountField
                label="Commission (optional)"
                value={commission}
                onChange={setCommission}
              />
              <Button title="Confirm Payment" icon="check-circle" onPress={() => handleRecordPayment(item)} />
              <Button title="Cancel" variant="ghost" onPress={() => setPayingId(null)} />
            </View>
          ) : (
            <View style={styles.payActions}>
              <Button
                title="Record Full Payment"
                variant="secondary"
                style={styles.flex1}
                onPress={() => {
                  const currency = resolveCurrencyCode(item.currency, preferred);
                  setPayingId(item.id);
                  setPaymentMoney({ amount: String(remaining), currency });
                  setCommission({ amount: '', currency });
                }}
              />
              <Button
                title="Partial"
                variant="ghost"
                onPress={() => {
                  const currency = resolveCurrencyCode(item.currency, preferred);
                  setPayingId(item.id);
                  setPaymentMoney({ amount: '', currency });
                  setCommission({ amount: '', currency });
                }}
              />
            </View>
          )
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader
        title="Receivables"
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      <FlashList
        data={receivables}
        keyExtractor={(r) => r.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={[styles.summary, { backgroundColor: colors.primary }]}>
              <Text style={[styles.summaryLabel, { color: colors.onPrimary + 'AA' }]}>OUTSTANDING RECEIVABLE</Text>
              <Text style={[styles.summaryValue, { color: colors.onPrimary }]}>{formatBase(summary.totalOutstanding)}</Text>
              {summary.overdueCount > 0 ? (
                <Text style={[styles.overdueHint, { color: colors.onPrimary + 'CC' }]}>
                  {summary.overdueCount} overdue · {formatBase(summary.overdueAmount)}
                </Text>
              ) : null}
            </View>

            {overdueItems.length > 0 ? (
              <View style={[styles.overdueBanner, { backgroundColor: colors.error + '12', borderColor: colors.error + '33' }]}>
                <Text style={[styles.overdueTitle, { color: colors.error }]}>
                  {overdueItems.length} overdue receivable{overdueItems.length === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}

          </View>
        }
        ListEmptyComponent={<EmptyState icon="account-balance-wallet" title="No receivables" subtitle="Track money owed to you here." />}
        renderItem={renderRow}
      />
      </KeyboardAvoidingView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add receivable"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push('/(marketplace)/money/receivables/add' as never)}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: Spacing.containerMargin, gap: Spacing.md, paddingBottom: Spacing.section + 72 },
  listHeader: { gap: Spacing.md, marginBottom: Spacing.sm },
  summary: { borderRadius: Radius.lg, padding: Spacing.xl },
  summaryLabel: { ...Typography.labelMd, letterSpacing: 1 },
  summaryValue: { ...Typography.displayLg, fontSize: 28, marginTop: 4 },
  overdueHint: { ...Typography.bodySmall, marginTop: 4 },
  overdueBanner: { padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  overdueTitle: { ...Typography.labelMd, fontWeight: '700' },
  row: { borderRadius: Radius.lg, padding: Spacing.gutterMd, gap: 6 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { ...Typography.headlineSm },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { ...Typography.labelMd, textTransform: 'capitalize' },
  desc: { ...Typography.bodyLg },
  meta: { ...Typography.caption },
  payForm: { gap: Spacing.sm, marginTop: Spacing.sm },
  payActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'center' },
  flex1: { flex: 1 },
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
