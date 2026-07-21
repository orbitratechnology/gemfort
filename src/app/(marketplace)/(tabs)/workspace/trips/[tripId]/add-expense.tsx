import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { TRIP_EXPENSE_CATEGORIES } from '@/constants/trip-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { addTripExpense } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from '@/lib/firebase/storage-service';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddTripExpenseScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState('transport');
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receipt, setReceipt] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user || !tripId) return;
    const parsed = parseFloat(money.amount);
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      let receiptPhotoUrl: string | null = null;
      if (receipt) {
        const ext = extensionForMedia(receipt);
        receiptPhotoUrl = await uploadLocalMedia(
          receipt,
          `trips/${user.uid}/${Date.now()}.${ext}`,
        );
      }

      await addTripExpense(user.uid, tripId, {
        category,
        amount: parsed,
        currency: money.currency,
        description: description || null,
        paymentMethod: paymentMethod || null,
        receiptPhotoUrl,
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
        <ScreenInset>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Log travel costs so overhead can be allocated to gems later.
        </Text>
        </ScreenInset>

        <FormSection title="Category" padded={false}>
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
                      backgroundColor: selected
                        ? colors.primaryContainer
                        : colors.surfaceContainerLow,
                      borderColor: selected ? colors.primary : colors.outlineVariant,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Icon
                    name={c.icon}
                    size={18}
                    color={selected ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                  />
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
        </FormSection>

        <ScreenInset style={styles.fields}>
        <CurrencyAmountField
          label="Amount"
          value={money}
          onChange={setMoney}
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional note"
          leftIcon="notes"
        />
        <Input
          label="Payment method"
          value={paymentMethod}
          onChangeText={setPaymentMethod}
          placeholder="Cash, card…"
          leftIcon="account-balance-wallet"
        />

        <MediaField
          label="Receipt"
          variant="row"
          value={receipt}
          onChange={setReceipt}
          emptyTitle="Add receipt photo"
          emptySubtitle="Kept on device until you save"
        />

        <Button title="Save expense" icon="shield" loading={loading} onPress={handleSubmit} />
        </ScreenInset>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
  },
  subtitle: { ...Typography.bodyMd },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
  },
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
  fields: { gap: Spacing.lg },
});
