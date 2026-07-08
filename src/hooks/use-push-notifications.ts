import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  canRegisterForPushNotifications,
  registerPushTokenForUser,
} from '@/lib/notifications/register-push-token';
import { updateFcmToken } from '@/lib/firebase/auth-service';
import { useAuth } from '@/providers/auth-provider';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const { user, isLoading } = useAuth();
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    uidRef.current = user?.uid ?? null;
  }, [user]);

  useEffect(() => {
    if (isLoading || !user || !canRegisterForPushNotifications()) return;

    let pushTokenSubscription: Notifications.EventSubscription | undefined;
    let cancelled = false;

    pushTokenSubscription = Notifications.addPushTokenListener((nextToken) => {
      const uid = uidRef.current;
      const tokenValue = typeof nextToken.data === 'string' ? nextToken.data.trim() : '';
      if (!uid || !tokenValue) return;
      void updateFcmToken(uid, tokenValue).catch((error) => {
        if (__DEV__) console.warn('[push] Token refresh save failed', error);
      });
    });

    void registerPushTokenForUser(user.uid).catch((error) => {
      if (!cancelled && __DEV__) {
        console.warn('[push] Initial registration failed', error);
      }
    });

    const onAppStateChange = (state: AppStateStatus) => {
      if (state !== 'active' || !uidRef.current) return;
      void registerPushTokenForUser(uidRef.current).catch(() => {});
    };

    const appStateSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      cancelled = true;
      pushTokenSubscription?.remove();
      appStateSub.remove();
    };
  }, [user, isLoading]);
}
