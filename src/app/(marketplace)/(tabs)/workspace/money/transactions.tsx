import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from '@/lib/firebase/db';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { Input } from '@/components/ui/input';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { groupTransactionsByDate } from '@/features/workspace/money-utils';
import {
  createTransaction,
  fetchGems,
  fetchTransactions,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';

export default function TransactionsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [gemId, setGemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  const { data: transactions = [], refetch, isRefetching } = useQuery({
    queryKey: ['transactions', user?.uid],
    queryFn: () => fetchTransactions(user!.uid),
    enabled: !!user,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const filteredTransactions = useMemo(() => {
    if (!search) return transactions;
    return transactions.filter(t => 
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase())
    );
  }, [transactions, search]);

  const sections = useMemo(() => groupTransactionsByDate(filteredTransactions), [filteredTransactions]);
  const gemById = useMemo(() => new Map(gems.map((g) => [g.id, g])), [gems]);

  async function handleAdd() {
    if (!user || !amount) return;
    setLoading(true);
    try {
      await createTransaction(user.uid, {
        type,
        amount: parseFloat(amount),
        currency: 'LKR',
        category: 'general',
        description: description || (type === 'income' ? 'Income' : 'Expense'),
        gemId,
        contactId: null,
        date: Timestamp.now(),
      });
      setAmount('');
      setDescription('');
      setGemId(null);
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save entry.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Transactions" />

      <View style={styles.container}>
        {/* Search & Quick Filters */}
        <View style={styles.searchSection}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outline + '1A' }]}>
            <View style={{ marginLeft: 12 }}>
              <Icon name="search" size={18} color={colors.outline} />
            </View>
            <TextInput 
              style={[styles.searchInput, { color: colors.textMain }]}
              placeholder="Search transactions..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {showForm && (
          <View style={[styles.form, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
            <View style={styles.formHeader}>
              <Text style={[styles.formTitle, { color: colors.primary }]}>New Transaction</Text>
              <Pressable onPress={() => setShowForm(false)}><Icon name="close" size={20} color={colors.onSurfaceVariant} /></Pressable>
            </View>
            <View style={styles.typeRow}>
              <Pressable 
                style={[styles.typeBtn, { backgroundColor: type === 'income' ? colors.successEmerald + '1A' : colors.surfaceContainerLow }]}
                onPress={() => setType('income')}
              >
                <Text style={[styles.typeText, { color: type === 'income' ? colors.successEmerald : colors.onSurfaceVariant }]}>Income</Text>
              </Pressable>
              <Pressable 
                style={[styles.typeBtn, { backgroundColor: type === 'expense' ? colors.error + '1A' : colors.surfaceContainerLow }]}
                onPress={() => setType('expense')}
              >
                <Text style={[styles.typeText, { color: type === 'expense' ? colors.error : colors.onSurfaceVariant }]}>Expense</Text>
              </Pressable>
            </View>
            <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="e.g. Sale of Sapphire" />
            <Button title="Add Transaction" loading={loading} onPress={handleAdd} style={{ marginTop: 8 }} />
          </View>
        )}

        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>No transactions yet. Tap + to record one.</Text>
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const linkedGem = item.gemId ? gemById.get(item.gemId) : null;
            const isIncome = item.type === 'income';
            return (
              <View style={[styles.txCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant + '80' }]}>
                <View style={styles.txLeft}>
                  <View style={[styles.txIconWrap, { backgroundColor: isIncome ? colors.successEmerald + '1A' : colors.error + '1A' }]}>
                    <Icon
                      name={isIncome ? 'add-circle' : 'do-not-disturb-on'}
                      size={24}
                      color={isIncome ? colors.successEmerald : colors.error}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <View style={styles.txHeaderRow}>
                      <Text style={[styles.txTitle, { color: colors.primary }]} numberOfLines={1}>{item.description || 'Transaction'}</Text>
                      <Text style={[styles.txAmount, { color: isIncome ? colors.successEmerald : colors.error }]}>
                        {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
                      </Text>
                    </View>
                    <View style={styles.txMetaRow}>
                      <Text style={[styles.txMeta, { color: colors.textMuted }]}>{item.category || 'General'}</Text>
                      <View style={[styles.dot, { backgroundColor: colors.outline + '4D' }]} />
                      <Text style={[styles.txMeta, { color: colors.textMuted }]}>
                        {item.date?.toDate ? item.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(item.date as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {linkedGem && (
                      <Text style={[styles.txNotes, { color: colors.onSurfaceVariant }]}>Linked: {linkedGem.sku}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* Floating Action Button */}
        {!showForm && (
          <Pressable 
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => setShowForm(true)}
          >
            <Icon name="add" size={28} color={colors.onPrimary} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
    zIndex: 50,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  brandName: { ...Typography.headlineMdMobile },
  bellBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  container: { flex: 1 },
  
  searchSection: { padding: Spacing.containerMargin, paddingTop: Spacing.stackMd },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, borderWidth: 1, height: 48 },
  searchInput: { flex: 1, paddingHorizontal: 12, ...Typography.bodyMd },

  form: { margin: Spacing.containerMargin, marginTop: 0, padding: 16, borderRadius: Radius.lg, borderWidth: 1, gap: 12, shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { ...Typography.headlineSm },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center' },
  typeText: { ...Typography.labelMd },

  list: { padding: Spacing.containerMargin, paddingTop: 0, paddingBottom: 100 },
  sectionHeader: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.gutterMd, marginTop: Spacing.sectionGap },
  empty: { ...Typography.bodyMd, textAlign: 'center', marginTop: Spacing.sectionGap },
  
  txCard: { padding: 16, borderRadius: Radius.lg, borderWidth: 1, marginBottom: Spacing.stackMd, shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 1 },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  txIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txTitle: { ...Typography.headlineSm, flex: 1, marginRight: 8 },
  txAmount: { ...Typography.headlineSm },
  txMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  txMeta: { ...Typography.bodyMd },
  dot: { width: 4, height: 4, borderRadius: 2 },
  txNotes: { ...Typography.bodyMd, fontStyle: 'italic', fontSize: 12, marginTop: 4 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
    zIndex: 100,
  },
});
