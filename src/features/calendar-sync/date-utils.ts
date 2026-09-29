export function isLocalDateOnly(date: Date): boolean {
  const isMinuteAligned =
    date.getSeconds() === 0 && date.getMilliseconds() === 0;
  const hasClockTime = date.getHours() !== 0 || date.getMinutes() !== 0;

  // Date-only workspace forms build timestamps from `new Date()` plus a day
  // offset, which leaves the current seconds and milliseconds on the value.
  // Treat that sub-minute residue as date-only; minute-aligned clock values
  // remain explicit times.
  return !isMinuteAligned || !hasClockTime;
}

/** Date-only records alert at 9 AM in the current device time zone. */
export function localAlertDate(date: Date): Date {
  if (!isLocalDateOnly(date)) return new Date(date);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    9,
    0,
    0,
    0,
  );
}

export function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  );
}
