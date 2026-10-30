import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { Accent, Callout } from '@/components/ui/detail-kit';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { SheetFooter } from '@/components/ui/sheet-footer';
import { StackHeader } from '@/components/ui/stack-header';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { Spacing } from '@/constants/design-tokens';
import { subscribeContacts } from '@/features/workspace/firestore-subscriptions';
import {
  createPayable,
  fetchContacts,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePendingAction } from '@/hooks/use-pending-action';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { friendlyError } from '@/lib/errors';
import { Timestamp } from '@/lib/firebase/db';
import { addPayableSchema, parseForm } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddPayableScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const preferred = usePreferredCurrency();
  const { formatFace } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [contactId, setContactId] = useState('');
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const contactName = useMemo(
    () => contacts.find((c) => c.id === contactId)?.displayName?.trim() || null,
    [contacts, contactId],
  );
  const draftAmount = parseFloat(money.amount) || 0;

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const [adding, handleAdd] = usePendingAction(async () => {
    if (!user) return;
    const result = parseForm(addPayableSchema, {
      contactId,
      amount: money.amount,
      title: title || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }

    setErrors({});
    try {
      const due = Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
      await createPayable(user.uid, {
        contactId: result.data.contactId ?? null,
        amount: result.data.amount,
        currency: money.currency,
        title: result.data.title,
        dueDate: due,
      });
      await queryClient.invalidateQueries({ queryKey: ['payables'] });
      toast.success('Payable added');
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save payable.'));
    }
  });

  if (!user) {
    return (
      <SignInPrompt
        title="Track your payables"
        message="Sign in to track money you owe."
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.sheet, { backgroundColor: colors.background }]}
      behavior="padding"
      automaticOffset
    >
      <StackHeader
        title="Add Payable"
        closeIcon
        image={require('@/assets/images/shortcuts/shortcut_money_light.png')}
      />
      <ThemedScrollView
        style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <FormSection>
          <Callout
            style={styles.summary}
            icon="north-east"
            accent={Accent.amber}
            label={contactName ? `You'll pay ${contactName}` : 'You owe'}
            value={draftAmount > 0 ? formatFace(draftAmount, money.currency) : 'Enter an amount'}
            pill="Due in 14 days"
          />
        </FormSection>
        <FormSection title="Contact">
          <ContactPicker
            label="To contact (optional)"
            contacts={contacts}
            value={contactId}
            allowClear
            onChange={(id) => {
              setContactId(id);
              clearField('contactId');
            }}
            error={errors.contactId}
          />
        </FormSection>
        <FormSection title="Details">
          <CurrencyAmountField
            label="Amount"
            value={money}
            onChange={(next) => {
              setMoney(next);
              clearField('amount');
            }}
            error={errors.amount}
          />
          <Input
            label="Title / Reason (required)"
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              clearField('title');
            }}
            placeholder="e.g. Advance for parcel"
            leftIcon="notes"
            error={errors.title}
          />
        </FormSection>
      </ThemedScrollView>
      <SheetFooter>
        <FormFooter title="Add Payable" icon="add" loading={adding} onPress={handleAdd} />
      </SheetFooter>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  summary: { marginTop: 0 },
});
