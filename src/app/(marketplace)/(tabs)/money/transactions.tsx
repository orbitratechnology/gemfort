import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Timestamp } from '@/lib/firebase/db';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import {
  Accent,
  Callout,
  IconBubble,
  KeyStats,
  ListItem,
  ListSectionHeader,
  TitleBand,
} from '@/components/ui/detail-kit';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { StackHeader } from '@/components/ui/stack-header';
import { Input } from '@/components/ui/input';
import { ReceiptField } from '@/components/ui/receipt-field';
import { SearchField } from '@/components/ui/search-field';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import { GemThumb } from '@/components/workspace/gem-thumb';
import {
  getPaymentSourceMeta,
  paymentSourceHref,
  sourceOfTransaction,
} from '@/features/workspace/payment-source';
import { groupTransactionsByDate } from '@/features/workspace/money-utils';
import { gemPrimaryPhotoUrl } from '@/features/workspace/party-photo';
import { subscribeGems } from '@/features/workspace/firestore-subscriptions';
import {
  createTransaction,
  fetchGems,
} from '@/features/workspace/workspace-service';
import { fetchTransactionsPage } from '@/features/workspace/workspace-pagination';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreInfiniteQuery } from '@/hooks/use-firestore-infinite-query';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { usePendingAction } from '@/hooks/use-pending-action';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { friendlyError } from '@/lib/errors';
import { uploadReceipt } from '@/lib/firebase/receipt-service';
import type { LocalMedia } from '@/lib/firebase/storage-service';
import { addTransactionSchema, parseForm } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { Transaction } from '@/types';

function signedBase(t: Transaction): number {
  const base = typeof t.amountBase === 'number' ? t.amountBase : 0;
  return t.type === 'income' ? base : -base;
}

function timeLabel(t: Transaction): string {
  const date = t.date?.toDate ? t.date.toDate() : new Date(t.date as any);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TYPE_OPTIONS = [
  { id: 'income', label: 'Income', icon: 'arrow-downward', accent: Accent.emerald },
  { id: 'expense', label: 'Expense', icon: 'arrow-upward', accent: Accent.rose },
] as const;

export default function TransactionsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const { formatBase, formatFace, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<LocalMedia | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    items: transactions,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ['transactions', user?.uid, 'infinite'],
    fetchPage: (cursor, pageSize) =>
      fetchTransactionsPage(user!.uid, cursor, pageSize),
    enabled: !!user,
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const filteredTransactions = useMemo(() => {
    if (!debouncedSearch) return transactions;
    const q = debouncedSearch.toLowerCase();
    return transactions.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }, [transactions, debouncedSearch]);

  const sections = useMemo(() => groupTransactionsByDate(filteredTransactions), [filteredTransactions]);
  const gemById = useMemo(() => new Map(gems.map((g) => [g.id, g])), [gems]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filteredTransactions) {
      const base = typeof t.amountBase === 'number' ? t.amountBase : 0;
      if (t.type === 'income') income += base;
      else expense += base;
    }
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  const [adding, handleAdd] = usePendingAction(async () => {
    if (!user) return;
    const result = parseForm(addTransactionSchema, {
      type,
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
      const receiptUrl = await uploadReceipt(user.uid, receipt);
      await createTransaction(user.uid, {
        type: result.data.type,
        amount: result.data.amount,
        currency: money.currency,
        category: 'general',
        description:
          result.data.description ||
          (type === 'income' ? 'Income' : 'Expense'),
        gemId: null,
        contactId: null,
        receiptUrl,
        date: Timestamp.now(),
      });
      setMoney({ amount: '', currency: preferred });
      setDescription('');
      setReceipt(null);
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save entry.'));
    }
  });

  const draftAmount = parseFloat(money.amount) || 0;
  const signed = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatBase(Math.abs(value))}`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Transactions" />

      <View style={styles.container}>
        <View style={styles.searchSection}>
          <SearchField
            placeholder="Search transactions..."
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            filteredTransactions.length > 0 ? (
              <TitleBand
                title={signed(totals.net)}
                subtitle={`Net across ${filteredTransactions.length} transaction${
                  filteredTransactions.length === 1 ? '' : 's'
                }${debouncedSearch ? ' matching your search' : ''}`}
              >
                <KeyStats
                  items={[
                    { label: 'Income', value: `+${formatBase(totals.income)}`, color: Accent.emerald },
                    { label: 'Expenses', value: `−${formatBase(totals.expense)}` },
                    { label: 'Entries', value: String(filteredTransactions.length) },
                  ]}
                />
              </TitleBand>
            ) : undefined
          }
          ListFooterComponent={
            <InfiniteListFooter
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              isFetchNextPageError={isFetchNextPageError}
              onRetry={() => void fetchNextPage()}
            />
          }
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          renderScrollComponent={(props) => <ScrollView {...props} />}
          ListEmptyComponent={
            <EmptyState icon="receipt-long" title="No transactions yet" subtitle="Tap + to record one." />
          }
          renderSectionHeader={({ section }) => {
            const dayNet = section.data.reduce((sum, t) => sum + signedBase(t), 0);
            return (
              <View style={[styles.bandHeader, { backgroundColor: colors.surfaceContainerLowest }]}>
                <ListSectionHeader
                  title={section.title}
                  trailing={signed(dayNet)}
                  trailingColor={dayNet > 0 ? Accent.emerald : undefined}
                />
              </View>
            );
          }}
          renderItem={({ item, index, section }) => {
            const linkedGem = item.gemId ? gemById.get(item.gemId) : null;
            const isIncome = item.type === 'income';
            const source = sourceOfTransaction(item);
            const sourceMeta = getPaymentSourceMeta(source?.type);
            const href = source ? paymentSourceHref(source.type, source.id) : null;
            return (
              <ListItem
                leading={
                  linkedGem ? (
                    <GemThumb
                      uri={gemPrimaryPhotoUrl(linkedGem)}
                      label={linkedGem.title?.trim() || linkedGem.sku || 'Gem'}
                      size={40}
                      radius={20}
                    />
                  ) : (
                    <IconBubble
                      icon={isIncome ? 'south-west' : 'north-east'}
                      accent={isIncome ? Accent.emerald : Accent.rose}
                      size={40}
                    />
                  )
                }
                title={item.description || 'Transaction'}
                subtitle={[
                  item.category || 'General',
                  source ? sourceMeta.label : null,
                  linkedGem ? `Linked: ${linkedGem.sku}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                meta={timeLabel(item)}
                amount={`${isIncome ? '+' : '−'}${formatStored({
                  amount: item.amount,
                  currency: item.currency,
                  amountBase: item.amountBase,
                })}`}
                amountColor={isIncome ? Accent.emerald : undefined}
                onPress={href ? () => router.push(href) : undefined}
                isLast={index === section.data.length - 1}
              />
            );
          }}
        />

        {!showForm && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => setShowForm(true)}
          >
            <Icon name="add" size={28} color={colors.onPrimary} />
          </Pressable>
        )}
      </View>

      <BottomSheet
        visible={showForm}
        onClose={() => {
          if (!adding) setShowForm(false);
        }}
        title="New Transaction"
        footer={
          <Button title="Add Transaction" icon="add" loading={adding} onPress={handleAdd} />
        }
      >
        <View
          style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}
          accessibilityRole="radiogroup"
        >
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.id;
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setType(opt.id)}
                style={[
                  styles.segmentBtn,
                  active && { backgroundColor: `${opt.accent}1A` },
                ]}
              >
                <Icon
                  name={opt.icon}
                  size={16}
                  color={active ? opt.accent : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? opt.accent : colors.onSurfaceVariant },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="e.g. Sale of Sapphire" leftIcon="notes" />
        <ReceiptField value={receipt} onChange={setReceipt} />
        {draftAmount > 0 ? (
          <Callout
            style={styles.preview}
            icon={type === 'income' ? 'south-west' : 'north-east'}
            accent={type === 'income' ? Accent.emerald : Accent.rose}
            label={type === 'income' ? 'Recording income' : 'Recording expense'}
            value={`${type === 'income' ? '+' : '−'}${formatFace(draftAmount, money.currency)}`}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  searchSection: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.stackMd,
  },
  list: { paddingBottom: 100 },
  bandHeader: { marginTop: 8 },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    gap: 6,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontFamily: FontFamily.semibold, fontSize: 14, includeFontPadding: false },
  preview: { marginTop: 0 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
});
