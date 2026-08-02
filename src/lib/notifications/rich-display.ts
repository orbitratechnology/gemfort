import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
  type Event,
} from 'react-native-notify-kit';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { ANDROID_CHANNELS } from '@/lib/notifications/categories';
import { navigateFromNotificationRef } from '@/lib/notification-navigation';

export const BACKGROUND_NOTIFICATION_TASK = 'GEMFORT_BACKGROUND_NOTIFICATION';

export type RichPushData = {
  title?: string;
  body?: string;
  type?: string;
  referenceType?: string;
  referenceId?: string;
  priority?: string;
  categoryId?: string;
  actorName?: string;
  actorPhotoUrl?: string;
  imageUrl?: string;
  largeIconUrl?: string;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value != null ? String(value) : '';
}

export function parseRichPushData(
  raw: Record<string, unknown> | null | undefined,
): RichPushData {
  if (!raw) return {};
  return {
    title: asString(raw.title) || undefined,
    body: asString(raw.body) || asString(raw.message) || undefined,
    type: asString(raw.type) || undefined,
    referenceType: asString(raw.referenceType) || undefined,
    referenceId: asString(raw.referenceId) || undefined,
    priority: asString(raw.priority) || undefined,
    categoryId: asString(raw.categoryId) || undefined,
    actorName: asString(raw.actorName) || undefined,
    actorPhotoUrl: asString(raw.actorPhotoUrl) || undefined,
    imageUrl: asString(raw.imageUrl) || undefined,
    largeIconUrl: asString(raw.largeIconUrl) || undefined,
  };
}

export async function ensureNotifeeChannels() {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: ANDROID_CHANNELS.default,
    name: 'GemFort updates',
    importance: AndroidImportance.DEFAULT,
  });
  await notifee.createChannel({
    id: ANDROID_CHANNELS.alerts,
    name: 'Due dates & reminders',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
  await notifee.createChannel({
    id: ANDROID_CHANNELS.urgent,
    name: 'Urgent alerts',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

function channelForPriority(priority?: string): string {
  if (priority === 'high') return ANDROID_CHANNELS.urgent;
  if (priority === 'medium') return ANDROID_CHANNELS.alerts;
  return ANDROID_CHANNELS.default;
}

/**
 * Display a system tray notification with:
 * - circular large icon = sender profile / business logo
 * - BigPicture = gem / listing art when available
 */
export async function displayRichNotification(data: RichPushData) {
  const title = data.title?.trim();
  const body = data.body?.trim();
  if (!title && !body) return;

  await ensureNotifeeChannels();

  const profileUrl =
    data.actorPhotoUrl?.trim() || data.largeIconUrl?.trim() || undefined;
  const gemUrl = data.imageUrl?.trim() || undefined;
  const channelId = channelForPriority(data.priority);

  if (Platform.OS === 'android') {
    await notifee.displayNotification({
      title: title || 'GemFort',
      body: body || undefined,
      subtitle: data.actorName || undefined,
      data: {
        type: data.type ?? '',
        referenceType: data.referenceType ?? '',
        referenceId: data.referenceId ?? '',
        categoryId: data.categoryId ?? '',
      },
      android: {
        channelId,
        pressAction: { id: 'default' },
        // Sender avatar (matches in-app notification row).
        ...(profileUrl
          ? {
              largeIcon: profileUrl,
              circularLargeIcon: true,
            }
          : {}),
        // Gem / listing image when available.
        ...(gemUrl
          ? {
              style: {
                type: AndroidStyle.BIGPICTURE,
                picture: gemUrl,
                largeIcon: profileUrl || null,
              },
            }
          : {}),
      },
    });
    return;
  }

  const attachments: {
    identifier: string;
    url: string;
    type: string;
  }[] = [];
  if (gemUrl) {
    attachments.push({
      identifier: 'gem',
      url: gemUrl,
      type: 'public.image',
    });
  } else if (profileUrl) {
    attachments.push({
      identifier: 'profile',
      url: profileUrl,
      type: 'public.image',
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title || 'GemFort',
      body: body || undefined,
      subtitle: data.actorName || undefined,
      categoryIdentifier: data.categoryId || undefined,
      data: {
        type: data.type ?? '',
        referenceType: data.referenceType ?? '',
        referenceId: data.referenceId ?? '',
        actorPhotoUrl: profileUrl ?? '',
        imageUrl: gemUrl ?? '',
      },
      ...(attachments.length > 0 ? { attachments } : {}),
      sound: data.priority === 'high' ? 'default' : undefined,
    },
    trigger: null,
  });
}

function extractDataFromTaskPayload(payload: unknown): RichPushData {
  if (!payload || typeof payload !== 'object') return {};
  const root = payload as Record<string, unknown>;

  // Notification response tap
  if ('actionIdentifier' in root && 'notification' in root) {
    const content = (root.notification as { request?: { content?: { data?: Record<string, unknown> } } })
      ?.request?.content;
    return parseRichPushData(content?.data);
  }

  // Background data message from expo-notifications task
  if ('data' in root) {
    const dataField = root.data as { dataString?: string } | Record<string, unknown>;
    if (dataField && typeof dataField === 'object' && 'dataString' in dataField) {
      try {
        return parseRichPushData(
          JSON.parse(String(dataField.dataString)) as Record<string, unknown>,
        );
      } catch {
        return {};
      }
    }
    return parseRichPushData(dataField as Record<string, unknown>);
  }

  // FCM remoteMessage shape
  if ('data' in root || 'notification' in root) {
    const remote = root as {
      data?: Record<string, unknown>;
      notification?: { title?: string; body?: string };
    };
    const parsed = parseRichPushData(remote.data);
    return {
      ...parsed,
      title: parsed.title || remote.notification?.title,
      body: parsed.body || remote.notification?.body,
    };
  }

  return parseRichPushData(root);
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.warn('[push] background task error', error);
    return;
  }
  const rich = extractDataFromTaskPayload(data);
  // Only present when we have media to upgrade, or data-only payload with title.
  if (rich.title || rich.body) {
    await displayRichNotification(rich);
  }
});

export async function registerBackgroundNotificationTask() {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (e) {
    if (__DEV__) console.warn('[push] registerTaskAsync failed', e);
  }
}

export function wireNotifeePressEvents() {
  return notifee.onForegroundEvent(({ type, detail }: Event) => {
    if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
    const data = detail.notification?.data ?? {};
    navigateFromNotificationRef(
      data.referenceType != null ? String(data.referenceType) : null,
      data.referenceId != null ? String(data.referenceId) : null,
    );
  });
}

export async function wireNotifeeBackgroundPress() {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
    const data = detail.notification?.data ?? {};
    navigateFromNotificationRef(
      data.referenceType != null ? String(data.referenceType) : null,
      data.referenceId != null ? String(data.referenceId) : null,
    );
  });
}
