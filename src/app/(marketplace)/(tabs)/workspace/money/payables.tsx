import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { effectivePayableStatus, getPayableSummary } from '@/features/workspace/payment-utils';
import {
  createPayable,
  fetchContacts,
  fetchPayables,
  recordPayablePayment,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';
import type { Payable } from '@/types';

export default function PayablesScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [contactId, setContactId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const { data: payables = [], refetch, isRefetching } = useQuery({
    queryKey: ['payables', user?.uid],
    queryFn: () => fetchPayables(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const summary = useMemo(() => getPayableSummary(payables), [payables]);
  const overdueItems = useMemo(
    () => payables.filter((p) => effectivePayableStatus(p) === 'overdue'),
    [payables],
  );

  async function handleAdd() {
    if (!user || !contactId || !amount) {
      toast.error('Select a contact and enter an amount.');
      return;
    }
    setLoading(true);
    try {
      const due = Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
      await createPayable(user.uid, {
        contactId,
        amount: parseFloat(amount),
        currency,
        description: description || 'Payable',
        dueDate: due,
      });
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      toast.success('Payable added');
      setAmount('');
      setDescription('');
      setContactId('');
      setCurrency('LKR');
      setShowForm(false);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save payable.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(item: Payable) {
    if (!user) return;
    const remaining = item.amount - item.amountPaid;
    const parsed = paymentAmount ? parseFloat(paymentAmount) : remaining;
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    setLoading(true);
    try {
      await recordPayablePayment(user.uid, item.id, parsed, {
        currency: item.currency,
        paymentMethod: paymentMethod || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Payment recorded');
      setPayingId(null);
      setPaymentAmount('');
      setPaymentMethod('');
    } catch (e) {
      toast.error(friendlyError(e, 'Payment could not be recorded.'));
    } finally {
      setLoading(false);
    }
  }

  function renderRow({ item }: { item: Payable }) {
    const remaining = item.amount - item.amountPaid;
    const status = effectivePayableStatus(item);
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
          Due {formatDate(item.dueDate)}
          {item.amountPaid > 0 ? ` · Paid ${formatCurrency(item.amountPaid, item.currency)}` : ''}
        </Text>
        {!paid ? (
          isPaying ? (
            <View style={styles.payForm}>
              <Input
                label="Payment amount"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder={String(remaining)}
              />
              <Input label="Payment method" value={paymentMethod} onChangeText={setPaymentMethod} placeholder="Cash, transfer…" />
              <Button title="Confirm Payment" loading={loading} onPress={() => handleRecordPayment(item)} />
              <Button title="Cancel" variant="ghost" onPress={() => setPayingId(null)} />
            </View>
          ) : (
            <View style={styles.payActions}>
              <Button
                title="Record Full Payment"
                variant="secondary"
                style={styles.flex1}
                onPress={() => {
                  setPayingId(item.id);
                  setPaymentAmount(String(remaining));
                }}
              />
              <Button
                title="Partial"
                variant="ghost"
                onPress={() => {
                  setPayingId(item.id);
                  setPaymentAmount('');
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
        title="Payables"
        right={
          <Pressable onPress={() => router.push('/(marketplace)/(tabs)/workspace/money/payments' as never)} hitSlop={8}>
            <Text style={[styles.historyLink, { color: colors.primary }]}>History</Text>
          </Pressable>
        }
      />
      <FlatList
        data={payables}
        keyExtractor={(p) => p.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={[styles.summary, { backgroundColor: colors.primary }]}>
              <Text style={[styles.summaryLabel, { color: colors.onPrimary + 'AA' }]}>OUTSTANDING PAYABLE</Text>
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
                  {overdueItems.length} overdue payable{overdueItems.length === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}

            {showForm ? (
              <View style={[styles.form, { backgroundColor: colors.surfaceContainerLowest }]}>
                <ContactPicker label="To contact" contacts={contacts} value={contactId} onChange={setContactId} />
                <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                <View style={styles.currencyRow}>
                  {SUPPORTED_CURRENCIES.slice(0, 4).map((c) => (
                    <Pressable
                      key={c.code}
                      onPress={() => setCurrency(c.code)}
                      style={[
                        styles.currencyChip,
                        {
                          backgroundColor: currency === c.code ? colors.primary : colors.surfaceContainerLow,
                          borderColor: currency === c.code ? colors.primary : colors.outlineVariant,
                        },
                      ]}>
                      <Text style={{ color: currency === c.code ? colors.onPrimary : colors.onSurface, ...Typography.labelMd }}>
                        {c.code}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Input label="Description" value={description} onChangeText={setDescription} />
                <Button title="Add Payable" loading={loading} onPress={handleAdd} />
                <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
              </View>
            ) : (
              <Button title="+ New Payable" onPress={() => setShowForm(true)} />
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState title="No payables" subtitle="Track money you owe here." />}
        renderItem={renderRow}
      />
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
  form: { borderRadius: Radius.lg, padding: Spacing.gutterMd, gap: Spacing.md },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  currencyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
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
