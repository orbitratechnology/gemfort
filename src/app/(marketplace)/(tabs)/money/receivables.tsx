import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
import {
  createReceivable,
  fetchContacts,
  fetchReceivables,
  recordReceivablePayment,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { formatCurrency, formatRelativeDue } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';
import type { Receivable } from '@/types';

export default function ReceivablesScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [contactId, setContactId] = useState('');
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
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

  const { data: receivables = [], refetch, isRefetching } = useQuery({
    queryKey: ['receivables', user?.uid],
    queryFn: () => fetchReceivables(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const summary = useMemo(() => getReceivableSummary(receivables), [receivables]);
  const overdueItems = useMemo(
    () => receivables.filter((r) => effectiveReceivableStatus(r) === 'overdue'),
    [receivables],
  );

  async function handleAdd() {
    if (!user || !contactId || !money.amount) {
      toast.error('Select a contact and enter an amount.');
      return;
    }
    setLoading(true);
    try {
      const due = Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
      await createReceivable(user.uid, {
        contactId,
        amount: parseFloat(money.amount),
        currency: money.currency,
        description: description || 'Receivable',
        dueDate: due,
      });
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast.success('Receivable added');
      setMoney({ amount: '', currency: preferred });
      setDescription('');
      setContactId('');
      setShowForm(false);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save receivable.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(item: Receivable) {
    if (!user) return;
    const remaining = item.amount - item.amountReceived;
    const parsed = paymentMoney.amount ? parseFloat(paymentMoney.amount) : remaining;
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    setLoading(true);
    try {
      await recordReceivablePayment(user.uid, item.id, parsed, {
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
    } catch (e) {
      toast.error(friendlyError(e, 'Payment could not be recorded.'));
    } finally {
      setLoading(false);
    }
  }

  function renderRow({ item }: { item: Receivable }) {
    const remaining = item.amount - item.amountReceived;
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
            {formatCurrency(remaining, item.currency)}
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
          {item.amountReceived > 0 ? ` · Received ${formatCurrency(item.amountReceived, item.currency)}` : ''}
        </Text>
        {!paid ? (
          isPaying ? (
            <View style={styles.payForm}>
              <CurrencyAmountField
                label="Payment amount"
                value={paymentMoney}
                onChange={setPaymentMoney}
                placeholder={String(remaining)}
              />
              <Input label="Payment method" value={paymentMethod} onChangeText={setPaymentMethod} placeholder="Cash, transfer…" leftIcon="account-balance-wallet" />
              <CurrencyAmountField
                label="Commission (optional)"
                value={commission}
                onChange={setCommission}
              />
              <Button title="Confirm Payment" icon="check-circle" loading={loading} onPress={() => handleRecordPayment(item)} />
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
      <FlatList
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
              <Text style={[styles.summaryValue, { color: colors.onPrimary }]}>{formatCurrency(summary.totalOutstanding)}</Text>
              {summary.overdueCount > 0 ? (
                <Text style={[styles.overdueHint, { color: colors.onPrimary + 'CC' }]}>
                  {summary.overdueCount} overdue · {formatCurrency(summary.overdueAmount)}
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
                <ContactPicker label="From contact" contacts={contacts} value={contactId} onChange={setContactId} />
                <CurrencyAmountField label="Amount" value={money} onChange={setMoney} />
                <Input label="Description" value={description} onChangeText={setDescription} leftIcon="notes" />
                <Button title="Add Receivable" icon="add" loading={loading} onPress={handleAdd} />
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
