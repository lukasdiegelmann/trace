/**
 * Diary dates: local YYYY-MM-DD strings, the streak and the week strip,
 * ported from LiftTrace `routes/Diary.svelte` and `lib/db.js`.
 */

/** The local calendar day as YYYY-MM-DD (not UTC) */
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parsed at local noon, so DST and UTC offsets never shift the day */
export function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

export function isValidDate(value: string | null | undefined): boolean {
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(parseLocalDate(value).getTime())
  );
}

/** Days from today: 0 today, -1 yesterday, 1 tomorrow */
export function dayOffset(
  date: string,
  today: string = localDateStr(),
): number {
  return Math.round(
    (parseLocalDate(date).getTime() - parseLocalDate(today).getTime()) /
      86400000,
  );
}

/**
 * Consecutive active days back from today, or from yesterday so a streak
 * survives the morning before anything is logged; 0 otherwise.
 */
export function streakCount(
  activeDates: Set<string>,
  today: string = localDateStr(),
): number {
  if (!activeDates.size) return 0;
  const yesterday = addDays(today, -1);
  let anchor: string;
  if (activeDates.has(today)) anchor = today;
  else if (activeDates.has(yesterday)) anchor = yesterday;
  else return 0;
  let count = 0;
  let day = anchor;
  while (activeDates.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export interface WeekDay {
  date: string;
  isDone: boolean;
  isToday: boolean;
}

/** The last seven days, oldest first, today last */
export function weekPeek(
  activeDates: Set<string>,
  today: string = localDateStr(),
): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, isDone: activeDates.has(date), isToday: i === 6 };
  });
}

/** Days of a month view: leading blanks (null) for the weekday of the 1st */
export function monthGrid(
  year: number,
  month: number,
  firstDayOfWeek = 1,
): (string | null)[] {
  const first = new Date(year, month, 1).getDay();
  const lead = (first - firstDayOfWeek + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push(localDateStr(new Date(year, month, day)));
  }
  return cells;
}

/** Minutes, hours or days since an ISO or SQLite time, for "3h ago" */
export interface RelativeTime {
  unit: "now" | "minute" | "hour" | "day" | "date";
  value: number;
}

export function relativeTime(
  time: string | null | undefined,
  now: number = Date.now(),
): RelativeTime | null {
  if (!time) return null;
  const iso = time.includes("T") ? time : `${time.replace(" ", "T")}Z`;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const minutes = Math.round((now - then) / 60000);
  if (minutes <= 1) return { unit: "now", value: 0 };
  if (minutes < 60) return { unit: "minute", value: minutes };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: "hour", value: hours };
  const days = Math.round(hours / 24);
  if (days < 7) return { unit: "day", value: days };
  return { unit: "date", value: then };
}
