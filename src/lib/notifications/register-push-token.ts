import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { updateFcmToken } from '@/lib/firebase/auth-service';
import {
  ANDROID_CHANNEL_ID,
  ensureAndroidNotificationChannels,
  registerNotificationCategories,
} from '@/lib/notifications/categories';

export { ANDROID_CHANNEL_ID };

export function canRegisterForPushNotifications(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'ios' && !Device.isDevice) return false;
  return true;
}

async function requestPushPermission(): Promise<boolean> {
  await ensureAndroidNotificationChannels();
  await registerNotificationCategories();

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
  } catch {
    if (attempt >= 3) return null;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    return fetchNativePushToken(attempt + 1);
  }
}

export async function registerPushTokenForUser(uid: string): Promise<string | null> {
  if (!canRegisterForPushNotifications()) return null;

  const granted = await requestPushPermission();
  if (!granted) return null;

  const token = await fetchNativePushToken();
  if (!token) return null;

  try {
    await updateFcmToken(uid, token);
  } catch (error) {
    throw error;
  }

  return token;
}
