import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
  EventType,
  type AndroidAction,
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

const BRAND_INK = '#171717';
const ALERT_AMBER = '#A66B12';
const CRITICAL_RED = '#B83A3A';

const LARGE_ICON_BY_REFERENCE = {
  ap: require('../../../assets/images/ap-icon.png'),
  service: require('../../../assets/images/lapidary-icon.png'),
  cheque: require('../../../assets/images/cheque-icon.png'),
  bill: require('../../../assets/images/bill-icon.png'),
  listing: require('../../../assets/images/mygems-icon.png'),
  default: require('../../../assets/images/gemfort-icon.png'),
} as const;

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
  await notifee.createChannel({
    id: ANDROID_CHANNELS.progress,
    name: 'Ongoing activity',
    description: 'Quiet progress for active trips, APs, cheques, bills, and services',
    importance: AndroidImportance.LOW,
    vibration: false,
    badge: false,
  });
}

function channelForPriority(priority?: string): string {
  if (priority === 'high') return ANDROID_CHANNELS.urgent;
  if (priority === 'medium') return ANDROID_CHANNELS.alerts;
  return ANDROID_CHANNELS.default;
}

function fallbackLargeIcon(referenceType?: string) {
  return (
    LARGE_ICON_BY_REFERENCE[
      referenceType as keyof typeof LARGE_ICON_BY_REFERENCE
    ] ?? LARGE_ICON_BY_REFERENCE.default
  );
}

function accentFor(data: RichPushData): string {
  const type = data.type ?? '';
  if (
    type === 'cheque_bounced' ||
    type.includes('overdue') ||
    type === 'verification_revoked' ||
    type === 'account_warning' ||
    type === 'account_suspended' ||
    type === 'account_banned'
  ) {
    return CRITICAL_RED;
  }
  if (type.includes('due') || type.includes('maturing')) return ALERT_AMBER;
  return BRAND_INK;
}

function androidCategoryFor(data: RichPushData): AndroidCategory {
  const type = data.type ?? '';
  if (type.startsWith('announcement_')) return AndroidCategory.PROMO;
  if (type === 'listing_offer_received') return AndroidCategory.SOCIAL;
  if (type.startsWith('account_') || type === 'cheque_bounced') {
    return AndroidCategory.ERROR;
  }
  if (type.includes('due') || type.includes('overdue') || type.includes('maturing')) {
    return AndroidCategory.REMINDER;
  }
  if (data.referenceType === 'service') return AndroidCategory.SERVICE;
  return AndroidCategory.STATUS;
}

function action(
  id: string,
  title: string,
): AndroidAction {
  return {
    title,
    pressAction: { id, launchActivity: 'default' },
  };
}

function actionsForCategory(categoryId?: string): AndroidAction[] {
  if (categoryId === 'ap_request') {
    return [action('accept', 'Accept'), action('decline', 'Decline'), action('view', 'Details')];
  }
  if (categoryId === 'ap_cancel') {
    return [
      action('accept_cancel', 'Allow cancel'),
      action('decline_cancel', 'Keep AP'),
      action('view', 'Details'),
    ];
  }
  if (categoryId === 'listing_offer') return [action('view', 'View listing')];
  return [action('view', 'View')];
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
    const senderIcon = profileUrl || fallbackLargeIcon(data.referenceType);
    await notifee.displayNotification({
      id: [data.type, data.referenceId].filter(Boolean).join(':') || undefined,
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
        smallIcon: 'notification_icon',
        largeIcon: senderIcon,
        circularLargeIcon: true,
        color: accentFor(data),
        category: androidCategoryFor(data),
        visibility: AndroidVisibility.PRIVATE,
        importance:
          data.priority === 'high'
            ? AndroidImportance.HIGH
            : data.priority === 'medium'
              ? AndroidImportance.DEFAULT
              : AndroidImportance.LOW,
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: actionsForCategory(data.categoryId),
        onlyAlertOnce: true,
        // Gem / listing image when available.
        ...(gemUrl
          ? {
              style: {
                type: AndroidStyle.BIGPICTURE,
                picture: gemUrl,
                // Keep the sender visible in both collapsed and expanded layouts.
                largeIcon: senderIcon,
                summary: data.actorName || undefined,
              },
            }
          : body
            ? {
                style: {
                  type: AndroidStyle.BIGTEXT,
                  text: body,
                  summary: data.actorName || undefined,
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

export type NotifeeActionHandler = (
  actionId: string,
  referenceType: string | null,
  referenceId: string | null,
  notificationId?: string,
) => void | Promise<void>;

export function wireNotifeePressEvents(onAction?: NotifeeActionHandler) {
  return notifee.onForegroundEvent(({ type, detail }: Event) => {
    if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
    const data = detail.notification?.data ?? {};
    const referenceType = data.referenceType != null ? String(data.referenceType) : null;
    const referenceId = data.referenceId != null ? String(data.referenceId) : null;
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id && onAction) {
      void onAction(detail.pressAction.id, referenceType, referenceId, detail.notification?.id);
      return;
    }
    navigateFromNotificationRef(
      referenceType,
      referenceId,
    );
  });
}

export async function wireNotifeeBackgroundPress(onAction?: NotifeeActionHandler) {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
    const data = detail.notification?.data ?? {};
    const referenceType = data.referenceType != null ? String(data.referenceType) : null;
    const referenceId = data.referenceId != null ? String(data.referenceId) : null;
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id && onAction) {
      await onAction(detail.pressAction.id, referenceType, referenceId, detail.notification?.id);
      return;
    }
    navigateFromNotificationRef(
      referenceType,
      referenceId,
    );
  });
}
