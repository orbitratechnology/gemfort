import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedView } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing, Typography } from '@/constants/design-tokens';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/workspace/workspace-service';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

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

  async function handleTap(id: string, refType: string | null, refId: string | null) {
    await markNotificationRead(id);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    if (refType === 'ap' && refId) {
      router.push(`/(marketplace)/(tabs)/workspace/ap/${refId}`);
    } else if (refType === 'service' && refId) {
      router.push(`/(marketplace)/(tabs)/workspace/services/${refId}`);
    } else if (refType === 'cheque' && refId) {
      router.push(`/(marketplace)/(tabs)/workspace/cheques/${refId}`);
    } else if (refType === 'receivable' && refId) {
      router.push('/(marketplace)/(tabs)/workspace/money/receivables');
    } else if (refType === 'verification') {
      router.push('/profile/verify');
    } else if (refType === 'announcement') {
      router.push('/(marketplace)/(tabs)/home');
    } else if (refType === 'account') {
      router.push('/(marketplace)/(tabs)/profile');
    }
  }

  async function handleMarkAllRead() {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, ts.textMuted]}>{unread} unread</Text>
        {unread > 0 ? (
          <Button title="Mark all read" variant="ghost" onPress={handleMarkAllRead} />
        ) : null}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="You're all caught up" />}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => handleTap(n.id, n.referenceType, n.referenceId)}>
            <Card style={[styles.card, !n.isRead && { borderLeftWidth: 3, borderLeftColor: ts.colors.accent }]}>
              <Text style={[styles.title, ts.text]}>{n.title}</Text>
              <Text style={[styles.message, ts.textSecondary]}>{n.message}</Text>
              <Text style={[styles.date, ts.textMuted]}>{formatDate(n.createdAt)}</Text>
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
  header: { ...Typography.body },
  list: { padding: Spacing.lg, paddingTop: Spacing.sm },
  card: { marginBottom: Spacing.sm },
  title: { ...Typography.h3 },
  message: { ...Typography.body },
  date: { ...Typography.caption, marginTop: 4 },
});
