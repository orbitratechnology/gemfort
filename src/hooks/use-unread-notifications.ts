import { subscribeNotifications } from '@/features/workspace/firestore-subscriptions';
import { fetchNotifications } from '@/features/workspace/workspace-service';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { useAuth } from '@/providers/auth-provider';

export function useUnreadNotificationCount(): number {
  const { user } = useAuth();

  const { data: notifications = [] } = useFirestoreLiveQuery({
    queryKey: ['notifications', user?.uid],
    queryFn: () => fetchNotifications(user!.uid),
    subscribe: (onData, onError) =>
      subscribeNotifications(user!.uid, onData, onError),
    enabled: !!user,
  });

  return notifications.filter((n) => !n.isRead).length;
}
