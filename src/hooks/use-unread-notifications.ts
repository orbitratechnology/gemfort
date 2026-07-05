import { useQuery } from '@tanstack/react-query';

import { fetchNotifications } from '@/features/workspace/workspace-service';
import { useAuth } from '@/providers/auth-provider';

export function useUnreadNotificationCount(): number {
  const { user } = useAuth();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.uid],
    queryFn: () => fetchNotifications(user!.uid),
    enabled: !!user,
    staleTime: 30_000,
  });

  return notifications.filter((n) => !n.isRead).length;
}
