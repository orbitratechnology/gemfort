import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { FormFooter } from '@/components/ui/form-footer';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { ContactPicker } from '@/components/workspace/contact-picker';
import { Spacing } from '@/constants/design-tokens';
import { subscribeContacts } from '@/features/workspace/firestore-subscriptions';
import {
  createReceivable,
  fetchContacts,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { friendlyError } from '@/lib/errors';
import { Timestamp } from '@/lib/firebase/db';
import { addReceivableSchema, parseForm } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddReceivableScreen() {
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
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleAdd() {
    if (!user) return;
    const result = parseForm(addReceivableSchema, {
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
      await withLoading(async () => {
        const due = Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
        await createReceivable(user.uid, {
          contactId: result.data.contactId ?? null,
          amount: result.data.amount,
          currency: money.currency,
          title: result.data.title,
          dueDate: due,
        });
        await queryClient.invalidateQueries({ queryKey: ['receivables'] });
        toast.success('Receivable added');
        router.back();
      }, 'Adding…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save receivable.'));
    }
  }

  if (!user) {
    return (
      <SignInPrompt
        title="Track your receivables"
        message="Sign in to track money owed to you."
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
        title="Add Receivable"
        closeIcon
        image={require('@/assets/images/shortcuts/shortcut_money_light.png')}
      />
      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ContactPicker
          label="From contact (optional)"
          contacts={contacts}
          value={contactId}
          allowClear
          onChange={(id) => {
            setContactId(id);
            clearField('contactId');
          }}
          error={errors.contactId}
        />
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
          placeholder="e.g. Sale on credit"
          leftIcon="notes"
          error={errors.title}
        />
      </ThemedScrollView>
      <FormFooter title="Add Receivable" icon="add" onPress={handleAdd} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: {
    padding: Spacing.containerMargin,
    gap: Spacing.md,
  },
});
