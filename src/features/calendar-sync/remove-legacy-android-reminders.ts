import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CLEANUP_KEY = "gemfort.calendar-sync.android-reminders-removed.v1";

export async function removeLegacyAndroidReminders(): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    if (await SecureStore.getItemAsync(CLEANUP_KEY)) return;

    const [scheduled, presented] = await Promise.all([
      Notifications.getAllScheduledNotificationsAsync(),
      Notifications.getPresentedNotificationsAsync(),
    ]);
    const legacyScheduled = scheduled.filter(
      (notification) =>
        notification.content.data?.gemfortCommitment === true,
    );
    const legacyPresented = presented.filter(
      (notification) =>
        notification.request.content.data?.gemfortCommitment === true,
    );

    const results = await Promise.allSettled([
      ...legacyScheduled.map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
      ...legacyPresented.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    ]);
    if (results.some((result) => result.status === "rejected")) return;

    await SecureStore.setItemAsync(CLEANUP_KEY, "done");
  } catch {
    // Retry the local cleanup on the next app launch.
  }
}
