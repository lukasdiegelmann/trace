/** Calendar days as the backends key them: local `YYYY-MM-DD` */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** db.js localDateStr: the local calendar day of a moment */
export function localDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Noon of a day, so DST shifts never move it to a neighbour */
export function parseDay(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

export function addDays(day: string, delta: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + delta);
  return localDateStr(date);
}

export function isIsoDay(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Every day from `from` to `to`, both included */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}

/** The last `count` days up to `today`, oldest first */
export function lastDays(
  count: number,
  today: string = localDateStr(),
): string[] {
  return daysBetween(addDays(today, -(count - 1)), today);
}

export type DateFormat = "ISO" | "US" | "EU" | "natural";

/** A day in the user's `dateFormat` (Statistics history, Wellness sub-label) */
export function formatDay(
  day: string,
  dateFormat: string,
  locale: string,
): string {
  const date = parseDay(day);
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  if (dateFormat === "US") return `${mm}/${dd}/${date.getFullYear()}`;
  if (dateFormat === "EU") return `${dd}/${mm}/${date.getFullYear()}`;
  if (dateFormat === "natural") {
    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return day;
}

export type RelativeTime =
  | { unit: "justNow" }
  | { unit: "seconds" | "minutes" | "hours" | "days"; count: number }
  | { unit: "yesterday" }
  | { unit: "date"; date: Date };

/** Wellness.svelte _fmtRelative: how long ago a sync was */
export function relativeTime(
  ms: number,
  now: number = Date.now(),
): RelativeTime {
  const seconds = Math.floor((now - ms) / 1000);
  if (seconds < 30) return { unit: "justNow" };
  if (seconds < 60) return { unit: "seconds", count: seconds };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { unit: "minutes", count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hours", count: hours };
  const days = Math.floor(hours / 24);
  if (days === 1) return { unit: "yesterday" };
  if (days < 7) return { unit: "days", count: days };
  return { unit: "date", date: new Date(ms) };
}
