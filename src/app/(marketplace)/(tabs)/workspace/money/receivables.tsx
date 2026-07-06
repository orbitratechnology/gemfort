import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  createReceivable,
  fetchContacts,
  fetchReceivables,
  recordReceivablePayment,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { Receivable } from '@/types';

export default function ReceivablesScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [contactId, setContactId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

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

  const totalOutstanding = receivables
    .filter((r) => r.status !== 'paid')
    .reduce((s, r) => s + (r.amount - r.amountReceived), 0);

  async function handleAdd() {
    if (!user || !contactId || !amount) {
      toast.error('Select a contact and enter an amount.');
      return;
    }
    setLoading(true);
    try {
      const due = Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
      await createReceivable(user.uid, {
        contactId,
        amount: parseFloat(amount),
        currency: 'LKR',
        description: description || 'Receivable',
        dueDate: due,
      });
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast.success('Receivable added');
      setAmount('');
      setDescription('');
      setContactId('');
      setShowForm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(item: Receivable) {
    const remaining = item.amount - item.amountReceived;
    const parsed = paymentAmount ? parseFloat(paymentAmount) : remaining;
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    setLoading(true);
    try {
      await recordReceivablePayment(item.id, parsed);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast.success('Payment recorded');
      setPayingId(null);
      setPaymentAmount('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  function renderRow({ item }: { item: Receivable }) {
    const remaining = item.amount - item.amountReceived;
    const isPaying = payingId === item.id;
    const paid = item.status === 'paid';

    return (
      <View style={[styles.row, { backgroundColor: colors.surfaceContainerLowest }]}>
        <View style={styles.rowHeader}>
          <Text style={[styles.amount, { color: paid ? colors.successEmerald : colors.primary }]}>
            {formatCurrency(remaining)}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: paid ? colors.successEmerald + '1A' : colors.warningAmber + '1A' }]}>
            <Text style={[styles.statusText, { color: paid ? colors.successEmerald : colors.warningAmber }]}>
              {item.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.desc, { color: colors.onSurface }]}>{item.description}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Due {formatDate(item.dueDate)}
          {item.amountReceived > 0 ? ` · Received ${formatCurrency(item.amountReceived)}` : ''}
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
      <StackHeader title="Receivables" />
      <FlatList
        data={receivables}
        keyExtractor={(r) => r.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={[styles.summary, { backgroundColor: colors.primary }]}>
              <Text style={[styles.summaryLabel, { color: colors.onPrimary + 'AA' }]}>OUTSTANDING RECEIVABLE</Text>
              <Text style={[styles.summaryValue, { color: colors.onPrimary }]}>{formatCurrency(totalOutstanding)}</Text>
            </View>
            {showForm ? (
              <View style={[styles.form, { backgroundColor: colors.surfaceContainerLowest }]}>
                <ContactPicker label="From contact" contacts={contacts} value={contactId} onChange={setContactId} />
                <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                <Input label="Description" value={description} onChangeText={setDescription} />
                <Button title="Add Receivable" loading={loading} onPress={handleAdd} />
                <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
              </View>
            ) : (
              <Button title="+ New Receivable" onPress={() => setShowForm(true)} />
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="No receivables" subtitle="Track money owed to you here." />
        }
        renderItem={renderRow}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: Spacing.containerMargin, gap: Spacing.md, paddingBottom: Spacing.section },
  listHeader: { gap: Spacing.md, marginBottom: Spacing.sm },
  summary: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  summaryLabel: { ...Typography.labelMd, letterSpacing: 1 },
  summaryValue: { ...Typography.displayLg, fontSize: 28, marginTop: 4 },
  form: {
    borderRadius: Radius.lg,
    padding: Spacing.gutterMd,
    gap: Spacing.md,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    borderRadius: Radius.lg,
    padding: Spacing.gutterMd,
    gap: 6,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
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
