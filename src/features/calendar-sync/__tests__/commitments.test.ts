import { makeSyncCommitment } from "@/features/calendar-sync/commitments";
import {
  addLocalDays,
  isLocalDateOnly,
  localAlertDate,
} from "@/features/calendar-sync/date-utils";

describe("one-time calendar commitments", () => {
  it("writes date-only trips as all-day events with a 9 AM local alert", () => {
    const start = new Date(2026, 8, 28, 14, 35, 17, 642);
    const end = new Date(2026, 8, 30, 14, 35, 17, 642);
    const commitment = makeSyncCommitment({
      surface: "calendar",
      sourceType: "trip",
      sourceId: "trip-1",
      title: "Trip: Bangkok",
      date: start,
      endDate: end,
      url: "gemfort:///workspace/trips/trip-1",
    });

    expect(commitment.allDay).toBe(true);
    expect(commitment.startDate.getDate()).toBe(28);
    expect(commitment.endDate.getDate()).toBe(1);
    expect(commitment.endDate.getMonth()).toBe(9);
    expect(commitment.alertDate.getHours()).toBe(9);
    expect(commitment.alertDate.getDate()).toBe(28);
  });

  it("sets date-only reminders to 9 AM and preserves an explicit local time", () => {
    const dateOnly = new Date(2026, 8, 28, 14, 35, 17, 642);
    const timed = new Date(2026, 8, 28, 14, 35);
    const reminder = (date: Date) =>
      makeSyncCommitment({
        surface: "reminder",
        sourceType: "bill",
        sourceId: "bill-1",
        title: "Bill due",
        date,
        url: "gemfort:///workspace/bills/bill-1",
      });

    expect(isLocalDateOnly(dateOnly)).toBe(true);
    expect(reminder(dateOnly).alertDate.getHours()).toBe(9);
    expect(isLocalDateOnly(timed)).toBe(false);
    expect(reminder(timed).alertDate.getTime()).toBe(timed.getTime());
  });

  it("keeps the same local clock time when adding a day across daylight saving", () => {
    const beforeTransition = new Date(2026, 2, 8);
    const afterTransition = addLocalDays(beforeTransition, 1);

    expect(afterTransition.getDate()).toBe(9);
    expect(afterTransition.getHours()).toBe(0);
    expect(afterTransition.getTime() - beforeTransition.getTime()).toBe(
      24 * 60 * 60 * 1000 +
        (afterTransition.getTimezoneOffset() - beforeTransition.getTimezoneOffset()) *
          60 * 1000,
    );
    expect(localAlertDate(beforeTransition).getHours()).toBe(9);
  });
});
