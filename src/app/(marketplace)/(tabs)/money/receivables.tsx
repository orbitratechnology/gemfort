import { FlashList } from '@/components/ui/gesture-lists';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { resolveCurrencyCode } from '@/constants/currencies';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  effectiveReceivableStatus,
  getReceivableSummary,
} from '@/features/workspace/payment-utils';
import { subscribeContacts, subscribeReceivables } from '@/features/workspace/firestore-subscriptions';
import {
  createReceivable,
  fetchContacts,
  fetchReceivables,
  recordReceivablePayment,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { outstandingBase } from '@/lib/money';
import { formatRelativeDue } from '@/lib/utils';
import {
  addReceivableSchema,
  parseForm,
  recordPaymentSchema,
} from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';
import type { Receivable } from '@/types';

export default function ReceivablesScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const { formatBase, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [contactId, setContactId] = useState('');
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMoney, setPaymentMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [commission, setCommission] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: receivables = [], refetch, isRefetching } = useFirestoreLiveQuery({
    queryKey: ['receivables', user?.uid],
    queryFn: () => fetchReceivables(user!.uid),
    subscribe: (onData, onError) => subscribeReceivables(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const summary = useMemo(() => getReceivableSummary(receivables), [receivables]);
  const overdueItems = useMemo(
    () => receivables.filter((r) => effectiveReceivableStatus(r) === 'overdue'),
    [receivables],
  );

  async function handleAdd() {
    if (!user) return;
    const result = parseForm(addReceivableSchema, {
      contactId,
      amount: money.amount,
      description: description || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }
    setErrors({});
    try {
      await withLoading(async () => {
        const due = Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
        await createReceivable(user.uid, {
          contactId: result.data.contactId,
          amount: result.data.amount,
          currency: money.currency,
          description: result.data.description || 'Receivable',
          dueDate: due,
        });
        await queryClient.invalidateQueries({ queryKey: ['receivables'] });
        toast.success('Receivable added');
        setMoney({ amount: '', currency: preferred });
        setDescription('');
        setContactId('');
        setShowForm(false);
      }, 'Adding…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save receivable.'));
    }
  }

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
        await recordReceivablePayment(user.uid, item.id, result.data.amount, {
          currency: paymentMoney.currency,
          paymentMethod: paymentMethod || null,
          commission: commission.amount ? parseFloat(commission.amount) : null,
        });
        await queryClient.invalidateQueries({ queryKey: ['receivables'] });
        await queryClient.invalidateQueries({ queryKey: ['payments'] });
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });
        toast.success('Payment recorded');
        setPayingId(null);
        setPaymentMoney({ amount: '', currency: preferred });
        setPaymentMethod('');
        setCommission({ amount: '', currency: preferred });
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
        <Text style={[styles.desc, { color: colors.onSurface }]}>{item.description}</Text>
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
          <Pressable onPress={() => router.push('/(marketplace)/(tabs)/money/payments' as never)} hitSlop={8}>
            <Text style={[styles.historyLink, { color: colors.primary }]}>History</Text>
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

            {showForm ? (
              <View style={[styles.form, { backgroundColor: colors.surfaceContainerLowest }]}>
                <ContactPicker
                  label="From contact"
                  contacts={contacts}
                  value={contactId}
                  onChange={(id) => {
                    setContactId(id);
                    setErrors((e) => {
                      if (!e.contactId) return e;
                      const next = { ...e };
                      delete next.contactId;
                      return next;
                    });
                  }}
                  error={errors.contactId}
                />
                <CurrencyAmountField
                  label="Amount"
                  value={money}
                  onChange={(next) => {
                    setMoney(next);
                    setErrors((e) => {
                      if (!e.amount) return e;
                      const nextErr = { ...e };
                      delete nextErr.amount;
                      return nextErr;
                    });
                  }}
                  error={errors.amount}
                />
                <Input label="Description" value={description} onChangeText={setDescription} leftIcon="notes" />
                <Button title="Add Receivable" icon="add" onPress={handleAdd} />
                <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
              </View>
            ) : (
              <Button title="+ New Receivable" icon="add" onPress={() => setShowForm(true)} />
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="account-balance-wallet" title="No receivables" subtitle="Track money owed to you here." />}
        renderItem={renderRow}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  historyLink: { ...Typography.labelMd, fontWeight: '600' },
  list: { padding: Spacing.containerMargin, gap: Spacing.md, paddingBottom: Spacing.section },
  listHeader: { gap: Spacing.md, marginBottom: Spacing.sm },
  summary: { borderRadius: Radius.lg, padding: Spacing.xl },
  summaryLabel: { ...Typography.labelMd, letterSpacing: 1 },
  summaryValue: { ...Typography.displayLg, fontSize: 28, marginTop: 4 },
  overdueHint: { ...Typography.bodySmall, marginTop: 4 },
  overdueBanner: { padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  overdueTitle: { ...Typography.labelMd, fontWeight: '700' },
  form: {
    borderRadius: Radius.lg,
    padding: Spacing.gutterMd,
    gap: Spacing.md,
  },
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
});
