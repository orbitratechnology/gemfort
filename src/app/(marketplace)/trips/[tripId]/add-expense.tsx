import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { PaymentMethodPicker } from '@/components/workspace/payment-method-picker';
import { TripContextSummary } from '@/components/workspace/trip-money-cards';
import { ThemedScrollView } from '@/components/ui/screen';
import { SheetFooter } from '@/components/ui/sheet-footer';
import { StackHeader } from '@/components/ui/stack-header';
import {
  TRIP_EXPENSE_CATEGORIES,
  TRIP_PAYMENT_OPTIONS,
  type TripPaymentMethod,
} from '@/constants/trip-options';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import { addTripExpense } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePendingAction } from '@/hooks/use-pending-action';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from '@/lib/firebase/storage-service';
import { friendlyError } from '@/lib/errors';
import { addTripExpenseSchema, parseForm } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddTripExpenseScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState('transport');
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<TripPaymentMethod>('cash');
  const [receipt, setReceipt] = useState<LocalMedia | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [submitting, handleSubmit] = usePendingAction(async () => {
    if (!user || !tripId) return;
    const result = parseForm(addTripExpenseSchema, {
      category,
      amount: money.amount,
      description: description || undefined,
      paymentMethod,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }
    setErrors({});

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
        category: result.data.category,
        amount: result.data.amount,
        currency: money.currency,
        description: result.data.description ?? null,
        paymentMethod: result.data.paymentMethod,
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
    }
  });

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader
        title="Add Expense"
        closeIcon
        image={require("@/assets/images/shortcuts/shortcut_money_light.png")}
      />

      <ThemedScrollView
        style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <TripContextSummary tripId={tripId} />

        <FormSection title="Category">
          <View style={styles.categoryGrid}>
            {TRIP_EXPENSE_CATEGORIES.map((c) => {
              const selected = category === c.id;
              const tone = selected ? colors.onPrimary : colors.onSurfaceVariant;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c.label}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    {
                      backgroundColor: selected
                        ? colors.primary
                        : colors.surfaceContainerLow,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Icon name={c.icon} size={18} color={tone} />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: selected ? colors.onPrimary : colors.onSurface },
                    ]}
                    numberOfLines={1}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <FormSection title="Payment">
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
          <PaymentMethodPicker
            label="Payment method"
            options={TRIP_PAYMENT_OPTIONS}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </FormSection>

        <FormSection title="Details">
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional note"
            leftIcon="notes"
          />
          <MediaField
            label="Receipt"
            variant="row"
            value={receipt}
            onChange={setReceipt}
            emptyTitle="Add receipt photo"
          />
        </FormSection>
      </ThemedScrollView>

      <SheetFooter>
        <FormFooter
          title="Save expense"
          icon="check"
          loading={submitting}
          onPress={handleSubmit}
        />
      </SheetFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    minHeight: 40,
  },
  pressed: { opacity: 0.85 },
  categoryLabel: {
    includeFontPadding: false,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    maxWidth: 104,
  },
});
