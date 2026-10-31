import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Timestamp } from '@/lib/firebase/db';

import { useMoneyChartTheme } from '@/components/money/money-chart-theme';
import { SegmentedControl } from '@/components/money/segmented-control';
import { ChoiceTileGrid } from '@/components/ui/choice-tile-grid';
import { FieldLabel } from '@/components/ui/field-chrome';
import { getCategoryMeta, MANUAL_CATEGORIES } from '@/constants/transaction-categories';

import { ScanFillStatus } from '@/components/scan/scan-fill-status';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import {
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
import { Spacing } from '@/constants/design-tokens';
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
import { useAutofillGuard, useDocumentReader } from '@/hooks/use-document-reader';
import { useFirestoreInfiniteQuery } from '@/hooks/use-firestore-infinite-query';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { usePendingAction } from '@/hooks/use-pending-action';
import { usePreferredMoney } from '@/hooks/use-preferred-money';
import { friendlyError } from '@/lib/errors';
import { uploadReceipt } from '@/lib/firebase/receipt-service';
import type { LocalMedia } from '@/lib/firebase/storage-service';
import { readReceipt } from '@/lib/document-extract';
import { mimeFromUri } from '@/lib/scan';
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

type EntryType = 'income' | 'expense';
type Filter = 'all' | EntryType;

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expenses' },
] as const;

const DEFAULT_CATEGORY: Record<EntryType, string> = {
  income: 'other_income',
  expense: 'general',
};

export default function TransactionsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const { formatBase, formatFace, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const chart = useMoneyChartTheme();
  const [type, setType] = useState<EntryType>('income');
  const [category, setCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [money, setMoney] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<LocalMedia | null>(null);
  const [showForm, setShowForm] = useState(false);
  // A scanned receipt (Scan & add) opens the new-transaction sheet with it
  // attached. Applied during render so it also works when this tab is
  // already mounted; each scan has a fresh file URI.
  const { receiptUri, compose } = useLocalSearchParams<{
    receiptUri?: string;
    compose?: EntryType;
  }>();
  const [appliedReceiptUri, setAppliedReceiptUri] = useState<string | null>(null);
  // "Add income" / "Add expense" on the Money overview open the sheet preset.
  const [appliedCompose, setAppliedCompose] = useState<string | null>(null);
  if (compose && compose !== appliedCompose && !receiptUri) {
    setAppliedCompose(compose);
    setType(compose === 'expense' ? 'expense' : 'income');
    setShowForm(true);
  }
  if (receiptUri && receiptUri !== appliedReceiptUri) {
    setAppliedReceiptUri(receiptUri);
    setReceipt({
      uri: receiptUri,
      kind: 'image',
      mimeType: mimeFromUri(receiptUri),
      fileName: 'scanned-receipt.webp',
    });
    setShowForm(true);
  }
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Read the receipt on device: an expense for its total, named after the
  // business, dated when it was issued. Typed values are never overwritten.
  const [scanDate, setScanDate] = useState<Date | null>(null);
  const [scanFilled, setScanFilled] = useState<string[] | null>(null);
  const autofill = useAutofillGuard<'type' | 'amount' | 'description'>({ type: 'income' });
  const { reading } = useDocumentReader(
    receipt?.kind === 'image' ? receipt.uri : null,
    readReceipt,
    (result) => {
      const filled: string[] = [];
      if (result?.amount && autofill.canFill('amount', money.amount)) {
        const amount = String(result.amount);
        setMoney((prev) => ({ amount, currency: result.currency ?? prev.currency }));
        autofill.mark('amount', amount);
        filled.push('amount');
        if (autofill.canFill('type', type)) {
          setType('expense');
          autofill.mark('type', 'expense');
        }
      }
      const name = [result?.merchant, result?.reference && `#${result.reference}`]
        .filter(Boolean)
        .join(' ')
        .slice(0, 200);
      if (name && autofill.canFill('description', description)) {
        setDescription(name);
        autofill.mark('description', name);
        filled.push('description');
      }
      setScanDate(result?.date ?? null);
      if (result?.date) filled.push('date');
      setScanFilled(filled);
    },
  );
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

  // A category picked for the other type falls back to this type's default.
  const entryCategory =
    category && MANUAL_CATEGORIES[type].includes(category) ? category : DEFAULT_CATEGORY[type];

  const filteredTransactions = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return transactions.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false;
      if (!q) return true;
      return (
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        getCategoryMeta(t.category).label.toLowerCase().includes(q)
      );
    });
  }, [transactions, debouncedSearch, filter]);

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
        category: entryCategory,
        description:
          result.data.description ||
          (type === 'income' ? 'Income' : 'Expense'),
        gemId: null,
        contactId: null,
        receiptUrl,
        date: scanDate ? Timestamp.fromDate(scanDate) : Timestamp.now(),
      });
      setMoney({ amount: '', currency: preferred });
      setDescription('');
      setReceipt(null);
      setScanDate(null);
      setScanFilled(null);
      setCategory(null);
      setShowForm(false);
      toast.success(result.data.type === 'income' ? 'Income recorded' : 'Expense recorded');
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
          <SegmentedControl
            accessibilityLabel="Show"
            options={FILTERS}
            value={filter}
            onChange={setFilter}
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
                fitTitle
                title={filter === 'all' ? signed(totals.net) : formatBase(filter === 'income' ? totals.income : totals.expense)}
                subtitle={`${filter === 'all' ? 'Net' : filter === 'income' ? 'Income' : 'Spent'} across ${
                  filteredTransactions.length
                } ${hasNextPage ? 'loaded ' : ''}entr${filteredTransactions.length === 1 ? 'y' : 'ies'}${
                  debouncedSearch ? ' matching your search' : ''
                }${hasNextPage ? ' · scroll for more' : ''}`}
              >
                {filter === 'all' ? (
                  <KeyStats
                    items={[
                      { label: 'Income', value: `+${formatBase(totals.income)}`, color: chart.income },
                      { label: 'Expenses', value: `−${formatBase(totals.expense)}` },
                      { label: 'Entries', value: String(filteredTransactions.length) },
                    ]}
                  />
                ) : null}
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
            <EmptyState
              icon="receipt-long"
              title={debouncedSearch || filter !== 'all' ? 'No matching transactions' : 'No transactions yet'}
              subtitle={
                debouncedSearch || filter !== 'all'
                  ? 'Try another search or show all entries.'
                  : 'Tap + to record income or an expense.'
              }
            />
          }
          renderSectionHeader={({ section }) => {
            const dayNet = section.data.reduce((sum, t) => sum + signedBase(t), 0);
            return (
              <View style={[styles.bandHeader, { backgroundColor: colors.surfaceContainerLowest }]}>
                <ListSectionHeader
                  title={section.title}
                  trailing={signed(dayNet)}
                  trailingColor={dayNet > 0 ? chart.income : undefined}
                />
              </View>
            );
          }}
          renderItem={({ item, index, section }) => {
            const linkedGem = item.gemId ? gemById.get(item.gemId) : null;
            const isIncome = item.type === 'income';
            const source = sourceOfTransaction(item);
            const href = paymentSourceHref(source.type, source.id);
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
                      accent={isIncome ? chart.income : chart.expense}
                      size={40}
                    />
                  )
                }
                title={item.description || 'Transaction'}
                subtitle={[
                  getCategoryMeta(item.category).label,
                  source.type ? getPaymentSourceMeta(source.type).label : null,
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
                amountColor={isIncome ? chart.income : undefined}
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
        title={type === 'income' ? 'Add income' : 'Add expense'}
        footer={
          <Button
            title={type === 'income' ? 'Save income' : 'Save expense'}
            icon="check"
            loading={adding}
            onPress={handleAdd}
          />
        }
      >
        <ScanFillStatus
          reading={reading}
          filled={scanFilled}
          document="receipt"
          style={styles.scanStatus}
        />
        <SegmentedControl
          accessibilityLabel="Entry type"
          options={[
            { id: 'income', label: 'Income', icon: 'south-west', accent: chart.income },
            { id: 'expense', label: 'Expense', icon: 'north-east', accent: chart.expense },
          ]}
          value={type}
          onChange={setType}
        />
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
        <View style={styles.categoryField}>
          <FieldLabel>Category</FieldLabel>
          <ChoiceTileGrid
            layout="row"
            columns={4}
            options={MANUAL_CATEGORIES[type].map((value) => ({
              value,
              label: getCategoryMeta(value).label,
              icon: getCategoryMeta(value).icon,
              accent: type === 'income' ? chart.income : chart.expense,
            }))}
            value={entryCategory}
            onChange={setCategory}
          />
        </View>
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder={type === 'income' ? 'e.g. Sale of Sapphire' : 'e.g. Courier to Colombo'}
          leftIcon="notes"
        />
        <ReceiptField
          value={receipt}
          onChange={(next) => {
            setReceipt(next);
            // The date only holds while the receipt it came from is attached.
            setScanDate(null);
            if (!next) setScanFilled(null);
          }}
        />
        {draftAmount > 0 ? (
          <Callout
            style={styles.preview}
            icon={type === 'income' ? 'south-west' : 'north-east'}
            accent={type === 'income' ? chart.income : chart.expense}
            label={type === 'income' ? 'Recording income' : 'Recording expense'}
            value={`${type === 'income' ? '+' : '−'}${formatFace(draftAmount, money.currency)}`}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scanStatus: { paddingHorizontal: 0 },
  categoryField: { gap: Spacing.sm },
  safe: { flex: 1 },
  container: { flex: 1 },
  searchSection: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.stackMd,
    gap: Spacing.md,
  },
  list: { paddingBottom: 100 },
  bandHeader: { marginTop: 8 },
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
