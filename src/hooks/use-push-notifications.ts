import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import {
  canRegisterForPushNotifications,
  registerPushTokenForUser,
} from '@/lib/notifications/register-push-token';
import { updateFcmToken } from '@/lib/firebase/auth-service';
import { useAuth } from '@/providers/auth-provider';

// Android tray UI is owned by react-native-notify-kit (profile largeIcon + gem BigPicture).
// iOS still uses the system presentation from APNs / local attachments.
Notifications.setNotificationHandler({
  handleNotification: async () =>
    Platform.OS === 'android'
      ? {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: false,
        }
      : {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        },
});

export function usePushNotifications() {
  const { user, profile, isLoading } = useAuth();
  const uidRef = useRef<string | null>(null);
  const registeringRef = useRef(false);

  useEffect(() => {
    uidRef.current = user?.uid ?? null;
  }, [user]);

  useEffect(() => {
    // Wait until a Firestore profile exists — prevents permission-denied when
    // Auth restores before/without a users/{uid} document.
    if (isLoading || !user || !profile || !canRegisterForPushNotifications()) return;

    const pushEnabled = profile.notificationPreferences?.pushEnabled !== false;
    if (!pushEnabled) return;

    let pushTokenSubscription: Notifications.EventSubscription | undefined;
    let cancelled = false;

    const saveToken = async (tokenValue: string) => {
      const uid = uidRef.current;
      if (!uid) return;
      try {
        await updateFcmToken(uid, tokenValue);
      } catch (error) {
        if (__DEV__) console.warn('[push] Token refresh save failed', error);
      }
    };

    const register = async () => {
      if (cancelled || registeringRef.current || !uidRef.current) return;
      registeringRef.current = true;
      try {
        await registerPushTokenForUser(uidRef.current);
      } catch (error) {
        if (!cancelled && __DEV__) {
          console.warn('[push] Initial registration failed', error);
        }
      } finally {
        registeringRef.current = false;
      }
    };

    pushTokenSubscription = Notifications.addPushTokenListener((nextToken) => {
      const tokenValue = typeof nextToken.data === 'string' ? nextToken.data.trim() : '';
      if (!tokenValue) return;
      void saveToken(tokenValue);
    });

    void register();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state !== 'active' || !uidRef.current) return;
      void register();
    };

    const appStateSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      cancelled = true;
      pushTokenSubscription?.remove();
      appStateSub.remove();
    };
  }, [user, profile, isLoading]);
}
