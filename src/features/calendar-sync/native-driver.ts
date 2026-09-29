import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import type { SyncCommitment } from "./commitments";

const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

async function writableCalendar(entityType: Calendar.EntityTypes) {
  if (Platform.OS === "ios" && entityType === Calendar.EntityTypes.EVENT) {
    try {
      // With write-only access on iOS 17+, this is a virtual writable calendar.
      return Calendar.getDefaultCalendarSync();
    } catch {
      // Fall back to a writable calendar if the default calendar is unavailable.
    }
  }

  const calendars = await Calendar.getCalendars(entityType);
  return (
    calendars.find((calendar) => calendar.isPrimary && calendar.allowsModifications) ??
    calendars.find((calendar) => calendar.allowsModifications) ??
    null
  );
}

export async function writeNativeCommitment(
  commitment: SyncCommitment,
): Promise<void> {
  if (commitment.surface === "calendar") {
    const calendar = await writableCalendar(Calendar.EntityTypes.EVENT);
    if (!calendar) throw new Error("No writable calendar is available.");
    await calendar.createEvent({
      title: commitment.title,
      startDate: commitment.startDate,
      endDate: commitment.endDate,
      allDay: commitment.allDay,
      timeZone: DEVICE_TIME_ZONE,
      alarms: [
        {
          relativeOffset: commitment.allDay
            ? Math.round(
                (commitment.alertDate.getTime() - commitment.startDate.getTime()) /
                  60_000,
              )
            : 0,
        },
      ],
      notes: `Added from GemFort\n${commitment.url}`,
      url: commitment.url,
    });
    return;
  }

  if (Platform.OS !== "ios") {
    throw new Error("Reminders are only available on iOS.");
  }

  const calendar = await writableCalendar(Calendar.EntityTypes.REMINDER);
  if (!calendar) throw new Error("No writable reminders list is available.");
  await calendar.createReminder({
    title: commitment.title,
    startDate: commitment.alertDate,
    dueDate: commitment.alertDate,
    allDay: false,
    timeZone: DEVICE_TIME_ZONE,
    alarms: [{ relativeOffset: 0 }],
    notes: `Added from GemFort\n${commitment.url}`,
    url: commitment.url,
    completed: false,
  });
}
