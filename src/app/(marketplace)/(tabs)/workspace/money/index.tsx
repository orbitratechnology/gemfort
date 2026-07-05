import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { getMonthTotals } from '@/features/workspace/money-utils';
import { fetchTransactions } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export default function MoneyDashboard() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', user?.uid],
    queryFn: () => fetchTransactions(user!.uid),
    enabled: !!user,
  });

  const { income, expense, net } = getMonthTotals(transactions);
  
  // Mock categories
  const categories: { name: string; amount: number; icon: IconName; color: string; bg: string }[] = [
    { name: 'Sourcing', amount: 24500, icon: 'diamond', color: colors.primary, bg: colors.primaryFixed },
    { name: 'Services', amount: 12200, icon: 'verified', color: colors.onTertiaryContainer, bg: colors.tertiaryFixed },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top App Bar */}
      <View style={[styles.header, { backgroundColor: colors.surfaceGlass }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarWrap, { borderColor: colors.primary + '1A' }]}>
            <Image 
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAr4Olq3KWL0YDS5yVbdRIFe8x6XhwdXmPB47jTzbP6PTcxOgo_xKngRlO4qRH-1VkyBrpbf4XbXVxoDDK-628erUG5uAVDjoVnB1leZu7XO-4RRgPidWUJRvArPF3DFP1ky2u_tw6lshreIGww9HDavGUb7PrcdnqKorFMpcq6KQL3OjcnL3ErJIeedKIwZDIsczBTpoSdKazIDogq8x9PZRYnqppdgDVXAQ1392-I1A0hQfKEcpKxvw' }} 
              style={styles.avatar} 
            />
          </View>
          <Text style={[styles.brandName, { color: colors.primary }]}>GemVault</Text>
        </View>
        <Pressable style={styles.bellBtn} onPress={() => router.push('/notifications')}>
          <Icon name="notifications-none" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* High-Level Summary */}
        <View style={[styles.glassCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>TOTAL NET PROFIT</Text>
          <View style={styles.rowBetween}>
            <Text style={[styles.displayLg, { color: colors.primary }]}>{formatCurrency(net)}</Text>
            <View style={[styles.trendBadge, { backgroundColor: colors.successEmerald + '1A' }]}>
              <Icon name="trending-up" size={14} color={colors.successEmerald} />
              <Text style={[styles.trendText, { color: colors.successEmerald }]}>+12.5%</Text>
            </View>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.primary + '0D' }]}>
              <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Income</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{formatCurrency(income)}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.error + '0D' }]}>
              <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Expenses</Text>
              <Text style={[styles.statValue, { color: colors.error }]}>{formatCurrency(expense)}</Text>
            </View>
          </View>
        </View>

        {/* Cash Flow Visualization */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Cash Flow</Text>
            <Pressable style={styles.dropdownBtn}>
              <Text style={[styles.dropdownText, { color: colors.primary }]}>This Month</Text>
              <Icon name="expand-more" size={16} color={colors.primary} />
            </Pressable>
          </View>
          
          <View style={[styles.glassCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
            <View style={styles.chartArea}>
              <View style={[styles.bar, { height: '60%', backgroundColor: colors.primary + '1A' }]} />
              <View style={[styles.bar, { height: '45%', backgroundColor: colors.primary + '1A' }]} />
              <View style={[styles.bar, { height: '85%', backgroundColor: colors.primary }]} />
              <View style={[styles.bar, { height: '30%', backgroundColor: colors.primary + '1A' }]} />
              <View style={[styles.bar, { height: '55%', backgroundColor: colors.accent }]} />
              <View style={[styles.bar, { height: '70%', backgroundColor: colors.primary + '1A' }]} />
              <View style={[styles.bar, { height: '40%', backgroundColor: colors.primary + '1A' }]} />
            </View>
            
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Inventory Sales</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Operations</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Categories Bento Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 12 }]}>Spend Categories</Text>
          <View style={styles.categoriesGrid}>
            {categories.map((cat, i) => (
              <View key={i} style={[styles.categoryCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
                <View style={[styles.catIconWrap, { backgroundColor: cat.bg }]}>
                  <Icon name={cat.icon} size={18} color={cat.color} />
                </View>
                <View>
                  <Text style={[styles.catLabel, { color: colors.onSurfaceVariant }]}>{cat.name}</Text>
                  <Text style={[styles.catAmount, { color: colors.primary }]}>{formatCurrency(cat.amount)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Recent Transactions</Text>
            <Pressable onPress={() => router.push('/(marketplace)/(tabs)/workspace/money/transactions')}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
            </Pressable>
          </View>
          
          <View style={styles.transactionsList}>
            {transactions.slice(0, 4).map(t => (
              <View key={t.id} style={[styles.txItem, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
                <View style={styles.txLeft}>
                  <View style={[styles.txIconWrap, { backgroundColor: t.type === 'income' ? colors.successEmerald + '1A' : colors.error + '1A' }]}>
                    <Icon
                      name={t.type === 'income' ? 'add' : 'remove'}
                      size={18}
                      color={t.type === 'income' ? colors.successEmerald : colors.error}
                    />
                  </View>
                  <View>
                    <Text style={[styles.txTitle, { color: colors.primary }]} numberOfLines={1}>{t.description || 'Transaction'}</Text>
                    <Text style={[styles.txDate, { color: colors.onSurfaceVariant }]}>{t.category || 'General'} • {t.date?.toDate ? t.date.toDate().toLocaleDateString() : new Date(t.date as any).toLocaleDateString()}</Text>
                  </View>
                </View>
                <Text style={[styles.txAmount, { color: t.type === 'income' ? colors.successEmerald : colors.error }]}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </Text>
              </View>
            ))}
            {transactions.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent transactions</Text>
            )}
          </View>
        </View>

      </ThemedScrollView>
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
  avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2 },
  avatar: { width: '100%', height: '100%' },
  brandName: { ...Typography.headlineMdMobile },
  bellBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  content: { padding: Spacing.containerMargin, paddingBottom: 100, gap: Spacing.sectionGap },
  
  glassCard: {
    padding: 24,
    borderRadius: Radius.lg,
    borderWidth: 1,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  label: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  displayLg: { ...Typography.displayLg },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginBottom: 4 },
  trendText: { ...Typography.labelMd },
  
  statsGrid: { flexDirection: 'row', gap: 16, marginTop: 24 },
  statBox: { flex: 1, padding: 16, borderRadius: Radius.md },
  statLabel: { ...Typography.labelMd, marginBottom: 4 },
  statValue: { ...Typography.headlineSm },

  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.stackMd },
  sectionTitle: { ...Typography.headlineSm },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dropdownText: { ...Typography.labelMd },
  viewAll: { ...Typography.labelMd, textDecorationLine: 'underline' },

  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 8 },
  bar: { flex: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { ...Typography.labelMd },

  categoriesGrid: { flexDirection: 'row', gap: 16 },
  categoryCard: { flex: 1, padding: 16, borderRadius: Radius.lg, borderWidth: 1, height: 128, justifyContent: 'space-between' },
  catIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  catLabel: { ...Typography.labelMd },
  catAmount: { ...Typography.headlineSm, fontWeight: 'bold' },

  transactionsList: { gap: 12 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: Radius.lg, borderWidth: 1 },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  txIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  txTitle: { ...Typography.bodyLg, fontWeight: 'bold', marginBottom: 2 },
  txDate: { ...Typography.labelMd, fontWeight: 'normal' },
  txAmount: { ...Typography.bodyLg, fontWeight: 'bold' },
  emptyText: { ...Typography.bodyMd, textAlign: 'center', padding: 24 },
});
