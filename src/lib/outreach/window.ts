/**
 * Send-window math in Wisconsin time (America/Chicago), DST-safe via Intl.
 * Emails go out on business days inside working hours, with jitter so a
 * batch doesn't land in inboxes at the same second.
 */
export const TZ = "America/Chicago";

type Window = { sendWindowStartHour: number; sendWindowEndHour: number; sendDays: number[] };

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local wall-clock parts of an instant in Chicago. */
export function localParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: +get("year"),
    month: +get("month"),
    day: +get("day"),
    hour: +get("hour"),
    minute: +get("minute"),
    dow: DOW[get("weekday")] ?? 0,
  };
}

/** Instant for a Chicago wall-clock time (handles CST/CDT). */
export function chicagoTime(year: number, month: number, day: number, hour: number, minute = 0): Date {
  // Guess with -6h, then correct by the observed offset.
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
  const p = localParts(guess);
  const drift = (p.hour - hour) * 60 + (p.minute - minute);
  const dayDrift = p.day !== day ? (p.day > day || (p.day === 1 && day > 27) ? 24 * 60 : -24 * 60) : 0;
  return new Date(guess.getTime() - (drift + dayDrift) * 60_000);
}

export function inWindow(d: Date, w: Window): boolean {
  const p = localParts(d);
  return w.sendDays.includes(p.dow) && p.hour >= w.sendWindowStartHour && p.hour < w.sendWindowEndHour;
}

/**
 * Earliest instant at or after `from` that falls in the send window, plus up to
 * `jitterMinutes` of random delay (kept inside the window).
 */
export function nextSendTime(from: Date, w: Window, jitterMinutes = 90, rand = Math.random): Date {
  const span = Math.max(1, (w.sendWindowEndHour - w.sendWindowStartHour) * 60 - 1);
  const jitter = Math.floor(rand() * Math.min(jitterMinutes, span));
  if (inWindow(from, w)) {
    const p = localParts(from);
    const minutesLeft = (w.sendWindowEndHour - p.hour) * 60 - p.minute - 1;
    return new Date(from.getTime() + Math.min(jitter, Math.max(0, minutesLeft)) * 60_000);
  }
  let p = localParts(from);
  // Today, before the window opens?
  if (w.sendDays.includes(p.dow) && p.hour < w.sendWindowStartHour) {
    return new Date(chicagoTime(p.year, p.month, p.day, w.sendWindowStartHour).getTime() + jitter * 60_000);
  }
  // Otherwise walk forward day by day (noon avoids DST edge cases).
  let cursor = chicagoTime(p.year, p.month, p.day, 12);
  for (let i = 0; i < 14; i++) {
    cursor = new Date(cursor.getTime() + 24 * 3_600_000);
    p = localParts(cursor);
    if (w.sendDays.includes(p.dow)) {
      return new Date(chicagoTime(p.year, p.month, p.day, w.sendWindowStartHour).getTime() + jitter * 60_000);
    }
  }
  return from;
}

/** `days` calendar days after `from`, then snapped into the send window. */
export function scheduleAfter(from: Date, days: number, w: Window, rand = Math.random): Date {
  return nextSendTime(new Date(from.getTime() + days * 86_400_000), w, 90, rand);
}
