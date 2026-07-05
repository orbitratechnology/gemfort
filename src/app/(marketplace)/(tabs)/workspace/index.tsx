import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Icon, type IconName } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { getMonthTotals } from '@/features/workspace/money-utils';
import {
  detectOverdueAp,
  detectOverdueServices,
  createNotification,
  fetchApRecords,
  fetchGems,
  fetchNotifications,
  fetchServices,
  fetchTransactions,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const modules: { title: string; route: string; icon: IconName }[] = [
  { title: 'My Gems', route: '/(marketplace)/(tabs)/workspace/gems', icon: 'diamond' },
  { title: 'Services', route: '/(marketplace)/(tabs)/workspace/services', icon: 'handyman' },
  { title: 'AP Stones', route: '/(marketplace)/(tabs)/workspace/ap', icon: 'hourglass-empty' },
  { title: 'Money', route: '/(marketplace)/(tabs)/workspace/money', icon: 'payments' },
  { title: 'Contacts', route: '/(marketplace)/(tabs)/workspace/contacts', icon: 'group' },
];

export default function WorkspaceHub() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const userId = user?.uid;

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', userId],
    queryFn: () => fetchGems(userId!),
    enabled: !!userId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', userId],
    queryFn: () => fetchServices(userId!),
    enabled: !!userId,
  });

  const { data: apRecords = [] } = useQuery({
    queryKey: ['ap', userId],
    queryFn: () => fetchApRecords(userId!),
    enabled: !!userId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', userId],
    queryFn: () => fetchTransactions(userId!),
    enabled: !!userId,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const overdueAp = detectOverdueAp(apRecords);
    const overdueServices = detectOverdueServices(services);
    const existingKeys = new Set(
      notifications
        .filter((n) => n.type === 'ap_overdue' || n.type === 'service_overdue')
        .map((n) => `${n.referenceType}:${n.referenceId}`),
    );

    overdueAp.forEach((a) => {
      if (existingKeys.has(`ap:${a.id}`)) return;
      createNotification(userId, {
        type: 'ap_overdue',
        title: 'AP Stone Overdue',
        message: 'An AP stone is past its expected return date.',
        referenceType: 'ap',
        referenceId: a.id,
      }).catch(() => {});
    });
    overdueServices.forEach((s) => {
      if (existingKeys.has(`service:${s.id}`)) return;
      createNotification(userId, {
        type: 'service_overdue',
        title: 'Service Overdue',
        message: 'A gem with a service provider is overdue.',
        referenceType: 'service',
        referenceId: s.id,
      }).catch(() => {});
    });
  }, [userId, apRecords, services, notifications]);

  if (!user) {
    return (
      <SignInPrompt
        title="Your workspace"
        message="Sign in to manage your private gem inventory, services, and finances."
      />
    );
  }

  const overdueServices = detectOverdueServices(services);
  const overdueAp = detectOverdueAp(apRecords);

  const { income: monthIncome, expense: monthExpense } = getMonthTotals(transactions);
  const totalInventoryValue = gems.reduce((sum, g) => sum + (g.acquisitionCost || 0), 0);

  const incomePct = monthIncome + monthExpense > 0 ? (monthIncome / (monthIncome + monthExpense)) * 100 : 0;
  const expensePct = monthIncome + monthExpense > 0 ? (monthExpense / (monthIncome + monthExpense)) * 100 : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* TopAppBar */}
      <View style={[styles.header, { backgroundColor: colors.surfaceGlass }]}>
        <View style={styles.headerLeft}>
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAGCqvWn4Zy4wzUo67hRhi-1j7cxmHesJ5rHpWH-kWtKqSMagfOxm_pcUiM5Cr_gomonhqSV7zR9i-J3HJ0K1_6PxD3okB_Pp9cUDpphjS-bi20iPSrF3jZ0LEEeGfnWlt96lssjqieC_wvvB7zmq7vS7lx2FRhtJrbwBjKWBAMNPiUlhtX6HJA-vyVLplLjIYQYwtDL4XH3kIzUQHM3_920_A_J41Ppnx0kE7GSWxvwe4sYZSY9tEvGQ' }} 
            style={styles.avatar} 
          />
          <Text style={[styles.brandName, { color: colors.primary }]}>GemVault</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} style={styles.bellBtn}>
          <Icon name="notifications-none" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Summary Section (Bento Grid Style) */}
        <View style={styles.bentoGrid}>
          <View style={[styles.bentoFull, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
            <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>TOTAL INVENTORY VALUE</Text>
            <View style={styles.bentoRow}>
              <Text style={[styles.bentoValueLg, { color: colors.primaryContainer }]}>{formatCurrency(totalInventoryValue)}</Text>
              <View style={[styles.trendBadge, { backgroundColor: colors.successEmerald + '1A' }]}>
                <Text style={[styles.trendText, { color: colors.successEmerald }]}>↗ +5.2%</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.bentoHalfRow}>
            <View style={[styles.bentoHalf, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
              <View style={styles.bentoHeader}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1A' }]}>
                  <Icon name="handyman" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>Services</Text>
              </View>
              <Text style={[styles.bentoValueSm, { color: colors.primaryContainer }]}>{services.length} Active</Text>
            </View>
            
            <View style={[styles.bentoHalf, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
              <View style={styles.bentoHeader}>
                <View style={[styles.iconWrap, { backgroundColor: colors.warningAmber + '1A' }]}>
                  <Icon name="hourglass-empty" size={16} color={colors.warningAmber} />
                </View>
                <Text style={[styles.bentoLabel, { color: colors.textMuted }]}>AP Stones</Text>
              </View>
              <Text style={[styles.bentoValueSm, { color: colors.primaryContainer }]}>{apRecords.length} Pending</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerLowest }]} onPress={() => router.push('/(marketplace)/(tabs)/workspace/gems/add')}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.primary }]}>
                <Icon name="add" size={24} color={colors.onPrimary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Add Gem</Text>
            </Pressable>
            
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerLowest }]} onPress={() => router.push('/(marketplace)/(tabs)/workspace/services/add')}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '0D', borderWidth: 1, borderColor: colors.primary + '33' }]}>
                <Icon name="design-services" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.onSurface }]}>New Service</Text>
            </Pressable>
            
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerLowest }]} onPress={() => router.push('/(marketplace)/(tabs)/workspace/money/record-sale')}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.secondaryContainer }]}>
                <Icon name="payments" size={20} color={colors.onSecondaryContainer} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Record Sale</Text>
            </Pressable>
            
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerLowest }]} onPress={() => router.push('/(marketplace)/(tabs)/workspace/contacts/add')}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '0D', borderWidth: 1, borderColor: colors.primary + '33' }]}>
                <Icon name="person-add" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Add Contact</Text>
            </Pressable>
          </View>
        </View>

        {/* Service Alerts */}
        {(overdueAp.length > 0 || overdueServices.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 0 }]}>Service Alerts</Text>
              <Pressable><Text style={[styles.seeAll, { color: colors.primary }]}>View All</Text></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alertsScroll}>
              {overdueAp.map(a => (
                <View key={a.id} style={[styles.alertCard, { backgroundColor: colors.surfaceContainerLowest, borderLeftColor: colors.error }]}>
                  <View style={styles.alertHeader}>
                    <View style={[styles.alertBadge, { backgroundColor: colors.error + '1A' }]}>
                      <Text style={[styles.alertBadgeText, { color: colors.error }]}>OVERDUE</Text>
                    </View>
                  </View>
                  <Text style={[styles.alertTitle, { color: colors.primaryContainer }]}>AP Stone</Text>
                  <Text style={[styles.alertDesc, { color: colors.textMuted }]} numberOfLines={1}>Past expected return date.</Text>
                  <View style={styles.alertFooter}>
                    <Text style={[styles.alertClient, { color: colors.onSurfaceVariant }]}>ID: {a.id.slice(0, 6)}</Text>
                    <Pressable onPress={() => router.push(`/(marketplace)/(tabs)/workspace/ap/${a.id}`)}>
                      <Text style={[styles.alertAction, { color: colors.primary }]}>Review</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {overdueServices.map(s => (
                <View key={s.id} style={[styles.alertCard, { backgroundColor: colors.surfaceContainerLowest, borderLeftColor: colors.warningAmber }]}>
                  <View style={styles.alertHeader}>
                    <View style={[styles.alertBadge, { backgroundColor: colors.warningAmber + '1A' }]}>
                      <Text style={[styles.alertBadgeText, { color: colors.warningAmber }]}>ACTION NEEDED</Text>
                    </View>
                  </View>
                  <Text style={[styles.alertTitle, { color: colors.primaryContainer }]}>Service</Text>
                  <Text style={[styles.alertDesc, { color: colors.textMuted }]} numberOfLines={1}>Overdue with provider.</Text>
                  <View style={styles.alertFooter}>
                    <Text style={[styles.alertClient, { color: colors.onSurfaceVariant }]}>ID: {s.id.slice(0, 6)}</Text>
                    <Pressable onPress={() => router.push(`/(marketplace)/(tabs)/workspace/services/${s.id}`)}>
                      <Text style={[styles.alertAction, { color: colors.primary }]}>Review</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Financial Overview Widget */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Financial Overview</Text>
          <View style={[styles.financeCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
            <View style={styles.financeHeader}>
              <Text style={[styles.financeSubtitle, { color: colors.textMuted }]}>This Month</Text>
              <Icon name="more-horiz" size={20} color={colors.outline} />
            </View>
            
            <View style={styles.financeRowWrap}>
              <View style={styles.financeRow}>
                <Text style={[styles.financeLabel, { color: colors.onSurface }]}>Income</Text>
                <Text style={[styles.financeAmount, { color: colors.successEmerald }]}>{formatCurrency(monthIncome)}</Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceContainerHighest }]}>
                <View style={[styles.progressBarFill, { backgroundColor: colors.successEmerald, width: `${incomePct || 0}%` }]} />
              </View>
            </View>

            <View style={styles.financeRowWrap}>
              <View style={styles.financeRow}>
                <Text style={[styles.financeLabel, { color: colors.onSurface }]}>Expense</Text>
                <Text style={[styles.financeAmount, { color: colors.error }]}>{formatCurrency(monthExpense)}</Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceContainerHighest }]}>
                <View style={[styles.progressBarFill, { backgroundColor: colors.error, width: `${expensePct || 0}%` }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Modules List (Legacy access) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>All Modules</Text>
          {modules.map((m) => (
            <Pressable 
              key={m.route} 
              style={[styles.moduleCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}
              onPress={() => router.push(m.route as never)}
            >
              <View style={[styles.moduleIconWrap, { backgroundColor: colors.primaryMuted }]}>
                <Icon name={m.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.moduleTitle, { color: colors.textMain }]}>{m.title}</Text>
              <Icon name="chevron-right" size={20} color={colors.outline} />
            </Pressable>
          ))}
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
    zIndex: 40,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  brandName: { ...Typography.headlineMdMobile },
  bellBtn: { padding: 8, borderRadius: Radius.full },
  
  content: { padding: Spacing.containerMargin, paddingBottom: 100, gap: Spacing.sectionGap },
  
  bentoGrid: { gap: 12 },
  bentoFull: { padding: 20, borderRadius: 16, borderWidth: 1, shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  bentoLabel: { ...Typography.labelMd, textTransform: 'uppercase', marginBottom: 4 },
  bentoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bentoValueLg: { ...Typography.displayLg },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginBottom: 4 },
  trendText: { ...Typography.labelMd },
  
  bentoHalfRow: { flexDirection: 'row', gap: 12 },
  bentoHalf: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, height: 110, justifyContent: 'space-between', shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  bentoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bentoValueSm: { ...Typography.headlineSm },

  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Spacing.stackMd },
  sectionTitle: { ...Typography.headlineMdMobile, marginBottom: Spacing.stackMd },
  seeAll: { ...Typography.labelMd },
  
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { width: '23%', aspectRatio: 1, borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  actionIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionLabel: { ...Typography.labelMd, textAlign: 'center' },

  alertsScroll: { gap: 16, paddingBottom: 16 },
  alertCard: { width: 280, borderRadius: 16, padding: 16, borderLeftWidth: 4, shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  alertBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  alertBadgeText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  alertTitle: { ...Typography.headlineSm, marginBottom: 4 },
  alertDesc: { ...Typography.bodyMd, marginBottom: 12 },
  alertFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertClient: { ...Typography.labelMd },
  alertAction: { ...Typography.labelMd },

  financeCard: { padding: 20, borderRadius: 16, borderWidth: 1, shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  financeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  financeSubtitle: { ...Typography.bodyMd },
  financeRowWrap: { marginBottom: 16 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  financeLabel: { fontSize: 14, fontWeight: '600' },
  financeAmount: { fontSize: 14, fontWeight: '600' },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden', width: '100%' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  moduleCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  moduleIconWrap: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  moduleTitle: { ...Typography.bodyLg, flex: 1 },
});
