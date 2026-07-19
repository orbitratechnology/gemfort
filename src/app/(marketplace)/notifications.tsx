import { Redirect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { ThemedView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/workspace/workspace-service';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { navigateFromNotificationRef } from '@/lib/notification-navigation';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

function iconForType(type: string): IconName {
  if (type.startsWith('cheque_')) return 'money-check-dollar';
  if (type.startsWith('ap_')) return 'hourglass-empty';
  if (type.startsWith('service_')) return 'handyman';
  if (type.startsWith('payment_')) return 'payments';
  if (type.startsWith('verification_')) return 'verified-user';
  if (type.startsWith('announcement_')) return 'campaign';
  if (type.startsWith('report_')) return 'flag';
  if (type.startsWith('account_')) return 'manage-accounts';
  return 'notifications';
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const ts = useThemeStyles();
  const queryClient = useQueryClient();

  const { data: notifications = [], refetch, isRefetching } = useQuery({
    queryKey: ['notifications', user?.uid],
    queryFn: () => fetchNotifications(user!.uid),
    enabled: !!user,
  });

  if (!user) return <Redirect href="/(auth)/login" />;

  const unread = notifications.filter((n) => !n.isRead).length;

  async function handleTap(
    id: string,
    refType: string | null,
    refId: string | null,
  ) {
    await markNotificationRead(id);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    navigateFromNotificationRef(refType, refId, { fromInbox: true });
  }

  async function handleMarkAllRead() {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="notifications" size={18} color={ts.colors.primary} />
          <Text style={[styles.header, ts.textMuted]}>{unread} unread</Text>
        </View>
        {unread > 0 ? (
          <Button
            title="Mark all read"
            icon="done-all"
            variant="ghost"
            onPress={handleMarkAllRead}
          />
        ) : null}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-none"
            title="You're all caught up"
            subtitle="New alerts about cheques, AP stones, and payments will show here."
          />
        }
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => handleTap(n.id, n.referenceType, n.referenceId)}
          >
            <Card
              style={[
                styles.card,
                !n.isRead && {
                  borderLeftWidth: 3,
                  borderLeftColor: ts.colors.accent,
                },
              ]}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: ts.colors.primaryMuted },
                  ]}
                >
                  <Icon
                    name={iconForType(n.type)}
                    size={20}
                    color={ts.colors.primary}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.title, ts.text]}>{n.title}</Text>
                  <Text style={[styles.message, ts.textSecondary]}>
                    {n.message}
                  </Text>
                  <View style={styles.metaRow}>
                    <Icon
                      name="schedule"
                      size={14}
                      color={ts.colors.textMuted}
                    />
                    <Text style={[styles.date, ts.textMuted]}>
                      {formatRelativeTime(n.createdAt)}
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={20} color={ts.colors.outline} />
              </View>
            </Card>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  header: { ...Typography.body },
  list: { padding: Spacing.lg, paddingTop: Spacing.sm },
  card: { marginBottom: Spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  title: { ...Typography.h3 },
  message: { ...Typography.body, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  date: { ...Typography.caption },
});
