import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
} from 'react-native-notify-kit';
import { Platform } from 'react-native';

import type { ActiveProgressItem } from '@/features/workspace/active-progress';
import { ANDROID_CHANNELS } from '@/lib/notifications/categories';
import { ensureNotifeeChannels } from '@/lib/notifications/rich-display';

const PREFIX = 'gemfort.progress.';
const GROUP_ID = 'gemfort-ongoing';
const MAX_VISIBLE = 3;

const FALLBACK_ICONS = {
  trip: require('../../../assets/images/trips-icon.png'),
  ap: require('../../../assets/images/ap-icon.png'),
  cheque: require('../../../assets/images/cheque-icon.png'),
  bill: require('../../../assets/images/bill-icon.png'),
  service: require('../../../assets/images/lapidary-icon.png'),
} as const;

const TIMING_LABEL: Record<ActiveProgressItem['kind'], string> = {
  trip: 'Trip ends',
  ap: 'Return due',
  cheque: 'Matures',
  bill: 'Due',
  service: 'Expected finish',
};

function notificationBody(item: ActiveProgressItem): string {
  let timing: string | null = null;
  if (item.when !== '—') {
    if (item.when === 'Yesterday' || item.when.endsWith(' overdue')) {
      const duration = item.when === 'Yesterday'
        ? '1 day'
        : item.when.replace(/ overdue$/, '');
      timing = `Overdue by ${duration}`;
    } else {
      timing = `${TIMING_LABEL[item.kind]}: ${item.when}`;
    }
  }

  return (
    [item.subtitle, timing].filter(Boolean).join(' · ') ||
    'Open GemFort to view details.'
  );
}

function notificationId(item: ActiveProgressItem): string {
  return `${PREFIX}${item.id.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
}

function referenceId(item: ActiveProgressItem): string {
  const prefix = `${item.kind}-`;
  return item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id;
}

let pendingSync: Promise<void> = Promise.resolve();

/** Mirrors the three front cards from the in-app progress stack into Android. */
export function syncActiveProgressNotifications(items: ActiveProgressItem[]): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();

  pendingSync = pendingSync.then(async () => {
    await ensureNotifeeChannels();
    const visible = items.slice(0, MAX_VISIBLE);
    const nextIds = new Set(visible.map(notificationId));
    const displayed = await notifee.getDisplayedNotifications();

    await Promise.all(
      displayed
        .map(({ notification }) => notification.id)
        .filter((id): id is string => !!id && id.startsWith(PREFIX) && !nextIds.has(id))
        .map((id) => notifee.cancelNotification(id)),
    );

    await Promise.all(
      visible.map((item) =>
        notifee.displayNotification({
          id: notificationId(item),
          title: `${item.badge} · ${item.title}`,
          body: notificationBody(item),
          data: {
            referenceType: item.kind,
            referenceId: referenceId(item),
          },
          android: {
            channelId: ANDROID_CHANNELS.progress,
            smallIcon: 'notification_icon',
            largeIcon: item.imageUrl?.trim() || FALLBACK_ICONS[item.kind],
            circularLargeIcon: item.kind !== 'trip',
            color: item.overdue ? '#B83A3A' : '#171717',
            category: AndroidCategory.STATUS,
            visibility: AndroidVisibility.PRIVATE,
            importance: AndroidImportance.LOW,
            groupId: GROUP_ID,
            ongoing: true,
            autoCancel: false,
            onlyAlertOnce: true,
            pressAction: { id: 'default', launchActivity: 'default' },
            actions: [
              {
                title: 'View',
                pressAction: { id: 'view', launchActivity: 'default' },
              },
            ],
          },
        }),
      ),
    );
  }).catch(() => {});

  return pendingSync;
}
