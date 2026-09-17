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
  const uid = user?.uid ?? null;
  const hasProfile = profile !== null;
  const pushEnabled = profile?.notificationPreferences?.pushEnabled !== false;
  const uidRef = useRef<string | null>(null);
  const registeringRef = useRef(false);
  const tokenRef = useRef<{ uid: string | null; token: string | null }>({
    uid: null,
    token: null,
  });

  useEffect(() => {
    uidRef.current = uid;
    if (tokenRef.current.uid !== uid) {
      tokenRef.current = { uid, token: profile?.fcmToken ?? null };
    } else if (profile?.fcmToken !== undefined) {
      tokenRef.current.token = profile.fcmToken ?? null;
    }
  }, [uid, profile?.fcmToken]);

  useEffect(() => {
    // Wait until a Firestore profile exists — prevents permission-denied when
    // Auth restores before/without a users/{uid} document.
    if (
      isLoading ||
      !uid ||
      !hasProfile ||
      !pushEnabled ||
      !canRegisterForPushNotifications()
    ) {
      return;
    }

    let pushTokenSubscription: Notifications.EventSubscription | undefined;
    let cancelled = false;

    const saveToken = async (tokenValue: string) => {
      const uid = uidRef.current;
      if (!uid) return;
      if (tokenRef.current.uid !== uid) {
        tokenRef.current = { uid, token: null };
      }

      const previousToken = tokenRef.current.token;
      if (previousToken === tokenValue) return;
      tokenRef.current.token = tokenValue;

      try {
        await updateFcmToken(uid, tokenValue);
      } catch {
        if (
          tokenRef.current.uid === uid &&
          tokenRef.current.token === tokenValue
        ) {
          tokenRef.current.token = previousToken;
        }
      }
    };

    const register = async () => {
      const uid = uidRef.current;
      if (cancelled || registeringRef.current || !uid) return;
      registeringRef.current = true;
      try {
        const token = await registerPushTokenForUser(uid, tokenRef.current.token);
        if (token && tokenRef.current.uid === uid) {
          tokenRef.current.token = token;
        }
      } catch {
        // Registration is retried when the app becomes active.
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
  }, [hasProfile, isLoading, pushEnabled, uid]);
}
