import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Icon, type IconName } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { getMonthTotals } from '@/features/workspace/money-utils';
import {
  detectOverdueAp,
  detectOverdueServices,
  createNotification,
  fetchApRecords,
  fetchContacts,
  fetchGems,
  fetchNotifications,
  fetchServices,
  fetchTransactions,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const WORKSPACE = '/(marketplace)/(tabs)/workspace';

export default function WorkspaceHub() {
  const { user } = useAuth();
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

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => fetchContacts(userId!),
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
  const alertCount = overdueServices.length + overdueAp.length;

  const { income: monthIncome, expense: monthExpense } = getMonthTotals(transactions);
  const monthNet = monthIncome - monthExpense;
  const totalInventoryValue = gems.reduce((sum, g) => sum + (g.acquisitionCost || 0), 0);
  const flowTotal = monthIncome + monthExpense;
  const incomePct = flowTotal > 0 ? (monthIncome / flowTotal) * 100 : 0;
  const expensePct = flowTotal > 0 ? (monthExpense / flowTotal) * 100 : 0;

  const stats: { label: string; value: number; icon: IconName; route: string }[] = [
    { label: 'Gems', value: gems.length, icon: 'diamond', route: `${WORKSPACE}/gems` },
    { label: 'Services', value: services.length, icon: 'handyman', route: `${WORKSPACE}/services` },
    { label: 'AP Stones', value: apRecords.length, icon: 'hourglass-empty', route: `${WORKSPACE}/ap` },
    { label: 'Contacts', value: contacts.length, icon: 'group', route: `${WORKSPACE}/contacts` },
  ];

  const actions: { label: string; icon: IconName; route: string; primary?: boolean }[] = [
    { label: 'Add Gem', icon: 'add', route: `${WORKSPACE}/gems/add`, primary: true },
    { label: 'Record Sale', icon: 'sell', route: `${WORKSPACE}/money/record-sale` },
    { label: 'New Service', icon: 'design-services', route: `${WORKSPACE}/services/add` },
    { label: 'Add Contact', icon: 'person-add', route: `${WORKSPACE}/contacts/add` },
  ];

  const tint = colors.primary + '14';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Workspace" showBack={false} />

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Inventory hero */}
        <View style={[styles.hero, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>TOTAL INVENTORY VALUE</Text>
          <Text style={[styles.heroValue, { color: colors.primary }]}>{formatCurrency(totalInventoryValue)}</Text>
          <Text style={[styles.heroSub, { color: colors.textMuted }]}>
            {gems.length} {gems.length === 1 ? 'gem' : 'gems'} in inventory
          </Text>
        </View>

        {/* Stat tiles */}
        <View style={styles.statGrid}>
          {stats.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => router.push(s.route as never)}
              style={({ pressed }) => [
                styles.statTile,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
                pressed && { opacity: 0.7 },
              ]}>
              <View style={[styles.statIcon, { backgroundColor: tint }]}>
                <Icon name={s.icon} size={20} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.primary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Quick actions</Text>
          <View style={styles.actionsRow}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => router.push(a.route as never)}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
                <View
                  style={[
                    styles.actionIcon,
                    a.primary
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: tint },
                  ]}>
                  <Icon name={a.icon} size={22} color={a.primary ? colors.onPrimary : colors.primary} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Alerts */}
        {alertCount > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Needs attention</Text>
            <View style={styles.alertList}>
              {overdueAp.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`${WORKSPACE}/ap/${a.id}` as never)}
                  style={({ pressed }) => [
                    styles.alertRow,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <View style={[styles.alertDot, { backgroundColor: colors.error }]} />
                  <View style={styles.alertText}>
                    <Text style={[styles.alertTitle, { color: colors.onSurface }]}>AP stone overdue</Text>
                    <Text style={[styles.alertSub, { color: colors.textMuted }]} numberOfLines={1}>
                      Past expected return · #{a.id.slice(0, 6)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.outline} />
                </Pressable>
              ))}
              {overdueServices.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`${WORKSPACE}/services/${s.id}` as never)}
                  style={({ pressed }) => [
                    styles.alertRow,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <View style={[styles.alertDot, { backgroundColor: colors.warningAmber }]} />
                  <View style={styles.alertText}>
                    <Text style={[styles.alertTitle, { color: colors.onSurface }]}>Service overdue</Text>
                    <Text style={[styles.alertSub, { color: colors.textMuted }]} numberOfLines={1}>
                      With provider · #{s.id.slice(0, 6)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.outline} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Finances */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface, marginBottom: 0 }]}>Finances</Text>
            <Pressable onPress={() => router.push(`${WORKSPACE}/money` as never)} hitSlop={8}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Details</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push(`${WORKSPACE}/money` as never)}
            style={({ pressed }) => [
              styles.financeCard,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
              pressed && { opacity: 0.9 },
            ]}>
            <View style={styles.financeTop}>
              <Text style={[styles.financeCaption, { color: colors.textMuted }]}>NET · THIS MONTH</Text>
              <Text
                style={[
                  styles.financeNet,
                  { color: monthNet >= 0 ? colors.successEmerald : colors.error },
                ]}>
                {monthNet >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(monthNet))}
              </Text>
            </View>

            <View style={styles.financeRowWrap}>
              <View style={styles.financeRow}>
                <Text style={[styles.financeLabel, { color: colors.onSurfaceVariant }]}>Income</Text>
                <Text style={[styles.financeAmount, { color: colors.successEmerald }]}>
                  {formatCurrency(monthIncome)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}>
                <View style={[styles.fill, { backgroundColor: colors.successEmerald, width: `${incomePct}%` }]} />
              </View>
            </View>

            <View style={styles.financeRowWrap}>
              <View style={styles.financeRow}>
                <Text style={[styles.financeLabel, { color: colors.onSurfaceVariant }]}>Expenses</Text>
                <Text style={[styles.financeAmount, { color: colors.error }]}>
                  {formatCurrency(monthExpense)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}>
                <View style={[styles.fill, { backgroundColor: colors.error, width: `${expensePct}%` }]} />
              </View>
            </View>
          </Pressable>
        </View>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const CARD_BORDER = 1;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackSm,
    paddingBottom: 120,
    gap: Spacing.sectionGap,
  },

  hero: {
    padding: Spacing.containerMargin,
    borderRadius: Radius.xl,
    borderWidth: CARD_BORDER,
    gap: 6,
  },
  heroLabel: { ...Typography.labelMd, letterSpacing: 1 },
  heroValue: { ...Typography.displayLg },
  heroSub: { ...Typography.bodyMd },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.stackMd },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderWidth: CARD_BORDER,
    gap: 10,
  },
  statIcon: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  statValue: { ...Typography.headlineMd },
  statLabel: { ...Typography.labelMd, letterSpacing: 0.4 },

  section: { gap: Spacing.stackMd },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.headlineSmMobile, marginBottom: 2 },
  seeAll: { ...Typography.labelMd },

  actionsRow: { flexDirection: 'row', gap: Spacing.stackMd },
  action: { flex: 1, alignItems: 'center', gap: 8 },
  actionIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { ...Typography.labelMd, textAlign: 'center' },

  alertList: { gap: Spacing.stackSm },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.stackMd,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderWidth: CARD_BORDER,
  },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { ...Typography.bodyLg, fontWeight: '600' },
  alertSub: { ...Typography.bodyMd },

  financeCard: {
    padding: Spacing.containerMargin,
    borderRadius: Radius.xl,
    borderWidth: CARD_BORDER,
    gap: Spacing.gutterMd,
  },
  financeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  financeCaption: { ...Typography.labelMd, letterSpacing: 1 },
  financeNet: { ...Typography.headlineSm },
  financeRowWrap: { gap: 8 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  financeLabel: { ...Typography.bodyMd, fontWeight: '600' },
  financeAmount: { ...Typography.bodyMd, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: 4 },
});
