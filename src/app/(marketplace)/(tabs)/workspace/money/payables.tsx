import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import { ThemedScrollView, ThemedView } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { Palette, Spacing, Typography } from '@/constants/design-tokens';
import {
  createPayable,
  fetchContacts,
  fetchPayables,
  recordPayablePayment,
} from '@/features/workspace/workspace-service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Payable } from '@/types';

export default function PayablesScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [contactId, setContactId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data: payables = [], refetch } = useQuery({
    queryKey: ['payables', user?.uid],
    queryFn: () => fetchPayables(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  async function handleAdd() {
    if (!user || !contactId || !amount) return;
    setLoading(true);
    try {
      const due = Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
      await createPayable(user.uid, {
        contactId,
        amount: parseFloat(amount),
        currency: 'LKR',
        description: description || 'Payable',
        dueDate: due,
      });
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      setAmount('');
      setDescription('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment(item: Payable) {
    const remaining = item.amount - item.amountPaid;
    const parsed = paymentAmount ? parseFloat(paymentAmount) : remaining;
    if (!parsed || parsed <= 0) {
      Alert.alert('Enter a valid payment amount');
      return;
    }
    setLoading(true);
    try {
      await recordPayablePayment(item.id, parsed);
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      setPayingId(null);
      setPaymentAmount('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  function renderRow({ item }: { item: Payable }) {
    const remaining = item.amount - item.amountPaid;
    const isPaying = payingId === item.id;

    return (
      <Card style={styles.row}>
        <Text style={styles.amount}>{formatCurrency(remaining)}</Text>
        <Text style={styles.desc}>{item.description}</Text>
        <Text style={styles.meta}>
          Due {formatDate(item.dueDate)} · {item.status}
          {item.amountPaid > 0 ? ` · Paid ${formatCurrency(item.amountPaid)}` : ''}
        </Text>
        {item.status !== 'paid' ? (
          isPaying ? (
            <View style={styles.payForm}>
              <Input
                label="Payment amount"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder={String(remaining)}
              />
              <Button
                title="Confirm Payment"
                loading={loading}
                onPress={() => handleRecordPayment(item)}
              />
              <Button title="Cancel" variant="ghost" onPress={() => setPayingId(null)} />
            </View>
          ) : (
            <View style={styles.payActions}>
              <Button
                title="Record Full Payment"
                variant="secondary"
                onPress={() => {
                  setPayingId(item.id);
                  setPaymentAmount(String(remaining));
                }}
              />
              <Button
                title="Partial Payment"
                variant="ghost"
                onPress={() => {
                  setPayingId(item.id);
                  setPaymentAmount('');
                }}
              />
            </View>
          )
        ) : null}
      </Card>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Card style={styles.form}>
        <ContactPicker
          label="To contact"
          contacts={contacts}
          value={contactId}
          onChange={setContactId}
        />
        <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Input label="Description" value={description} onChangeText={setDescription} />
        <Button title="Add Payable" loading={loading} onPress={handleAdd} />
      </Card>
      <FlatList
        data={payables}
        keyExtractor={(p) => p.id}
        onRefresh={refetch}
        refreshing={false}
        contentContainerStyle={styles.list}
        renderItem={renderRow}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { margin: Spacing.lg, gap: Spacing.sm },
  list: { padding: Spacing.lg, paddingTop: 0 },
  row: { marginBottom: Spacing.sm, gap: Spacing.sm },
  amount: { ...Typography.h3, color: Palette.error },
  desc: { ...Typography.body, color: Palette.gray900 },
  meta: { ...Typography.caption, color: Palette.gray500 },
  payForm: { gap: Spacing.sm, marginTop: Spacing.sm },
  payActions: { gap: Spacing.xs, marginTop: Spacing.sm },
});
