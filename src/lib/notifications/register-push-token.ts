import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { updateFcmToken } from '@/lib/firebase/auth-service';

export const ANDROID_CHANNEL_ID = 'default';

export function canRegisterForPushNotifications(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'ios' && !Device.isDevice) return false;
  return true;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'GemFort alerts',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

async function requestPushPermission(): Promise<boolean> {
  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (Platform.OS === 'ios') {
    const iosStatus = (await Notifications.getPermissionsAsync()).ios?.status;
    return (
      finalStatus === 'granted' ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }

  return finalStatus === 'granted';
}

function normalizeDeviceToken(token: Notifications.DevicePushToken): string | null {
  const value = typeof token.data === 'string' ? token.data.trim() : '';
  return value.length > 0 ? value : null;
}

async function fetchNativePushToken(attempt = 1): Promise<string | null> {
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    return normalizeDeviceToken(deviceToken);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[push] getDevicePushTokenAsync failed (attempt ${attempt})`, error);
    }
    if (attempt >= 3) return null;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    return fetchNativePushToken(attempt + 1);
  }
}

export async function registerPushTokenForUser(uid: string): Promise<string | null> {
  if (!canRegisterForPushNotifications()) {
    if (__DEV__) {
      console.warn('[push] Skipped registration on this platform/device');
    }
    return null;
  }

  const granted = await requestPushPermission();
  if (!granted) {
    if (__DEV__) {
      console.warn('[push] Notification permission not granted');
    }
    return null;
  }

  const token = await fetchNativePushToken();
  if (!token) {
    if (__DEV__) {
      console.warn('[push] No native push token returned from FCM/APNs');
    }
    return null;
  }

  try {
    await updateFcmToken(uid, token);
    if (__DEV__) {
      console.log('[push] Saved FCM token for user', uid);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[push] Failed to save token to Firestore', error);
    }
    throw error;
  }

  return token;
}
