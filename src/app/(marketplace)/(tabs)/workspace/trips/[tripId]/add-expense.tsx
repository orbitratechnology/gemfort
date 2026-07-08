import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { TRIP_EXPENSE_CATEGORIES } from '@/constants/trip-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { addTripExpense } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { uploadPickedImage } from '@/lib/firebase/storage-service';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddTripExpenseScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState('transport');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleUploadReceipt() {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadPickedImage(`trips/${user.uid}/${Date.now()}.jpg`);
      if (url) {
        setReceiptUrl(url);
        toast.success('Receipt photo added.');
      }
    } catch (e) {
      toast.error(friendlyError(e, 'Could not upload receipt.'));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!user || !tripId) return;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      await addTripExpense(user.uid, tripId, {
        category,
        amount: parsed,
        description: description || null,
        paymentMethod: paymentMethod || null,
        receiptPhotoUrl: receiptUrl,
      });
      await queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] });
      await queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Expense logged on trip.');
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save expense.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add Expense" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Log travel costs so overhead can be allocated to gems later.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {TRIP_EXPENSE_CATEGORIES.map((c) => {
              const selected = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    {
                      backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLow,
                      borderColor: selected ? colors.primary : colors.outlineVariant,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Icon name={c.icon} size={18} color={selected ? colors.onPrimaryContainer : colors.onSurfaceVariant} />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: selected ? colors.onPrimaryContainer : colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input label="Amount (LKR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Optional note" />
        <Input label="Payment method" value={paymentMethod} onChangeText={setPaymentMethod} placeholder="Cash, card…" />

        <Pressable
          onPress={handleUploadReceipt}
          disabled={uploading}
          style={({ pressed }) => [
            styles.receiptBtn,
            { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
            pressed && { opacity: 0.85 },
          ]}>
          <Icon name={receiptUrl ? 'check-circle' : 'photo-camera'} size={22} color={colors.primary} />
          <Text style={[styles.receiptText, { color: colors.onSurface }]}>
            {uploading ? 'Uploading…' : receiptUrl ? 'Receipt attached' : 'Add receipt photo'}
          </Text>
        </Pressable>

        <Button title="Save expense" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.section, gap: Spacing.lg },
  subtitle: { ...Typography.bodyMd },
  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 0.8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 40,
  },
  categoryLabel: { ...Typography.labelMd, fontWeight: '600', maxWidth: 88 },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    minHeight: 52,
  },
  receiptText: { ...Typography.bodyMd, fontWeight: '600' },
});
