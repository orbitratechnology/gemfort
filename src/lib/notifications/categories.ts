import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Android channels — must match Cloud Functions `pushChannelForType`. */
export const ANDROID_CHANNELS = {
  default: 'default',
  alerts: 'alerts',
  urgent: 'urgent',
  progress: 'progress',
} as const;

export const ANDROID_CHANNEL_ID = ANDROID_CHANNELS.default;

/** Interactive push categories — must match Cloud Functions `pushCategoryForType`. */
export const PUSH_CATEGORIES = {
  openRef: 'open_ref',
  apRequest: 'ap_request',
  apCancel: 'ap_cancel',
  listingOffer: 'listing_offer',
} as const;

export async function ensureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.default, {
    name: 'GemFort updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    description: 'General marketplace and workspace updates',
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.alerts, {
    name: 'Due dates & reminders',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Cheques, bills, AP returns, and payment reminders',
    vibrationPattern: [0, 250, 120, 250],
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.urgent, {
    name: 'Urgent alerts',
    importance: Notifications.AndroidImportance.MAX,
    description: 'Bounced cheques, overdues, and account security',
    vibrationPattern: [0, 400, 200, 400],
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.progress, {
    name: 'Ongoing activity',
    importance: Notifications.AndroidImportance.LOW,
    description: 'Quiet progress for active trips, APs, cheques, bills, and services',
    showBadge: false,
  });
}

export async function registerNotificationCategories() {
  await Notifications.setNotificationCategoryAsync(PUSH_CATEGORIES.openRef, [
    {
      identifier: 'view',
      buttonTitle: 'View',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(PUSH_CATEGORIES.apRequest, [
    {
      identifier: 'accept',
      buttonTitle: 'Accept',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'decline',
      buttonTitle: 'Decline',
      options: {
        opensAppToForeground: true,
        isDestructive: true,
      },
    },
    {
      identifier: 'view',
      buttonTitle: 'Details',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(PUSH_CATEGORIES.apCancel, [
    {
      identifier: 'accept_cancel',
      buttonTitle: 'Allow cancel',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'decline_cancel',
      buttonTitle: 'Keep AP',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'view',
      buttonTitle: 'Details',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync(
    PUSH_CATEGORIES.listingOffer,
    [
      {
        identifier: 'view',
        buttonTitle: 'View listing',
        options: { opensAppToForeground: true },
      },
    ],
  );
}
