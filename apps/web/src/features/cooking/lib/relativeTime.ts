/**
 * "3 days ago" / "in 2 weeks" and short dates, ported from
 * cooktrace/src/lib/relative-time.js. The buckets are the original's; the
 * words come from `Intl.RelativeTimeFormat` in the UI language instead of
 * hard-coded English.
 */

/**
 * A date from what the server sends. "YYYY-MM-DD" is local midnight (diary
 * dates); SQLite's naive "YYYY-MM-DD HH:MM:SS" is UTC.
 */
export function toDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input !== "string") return new Date(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(
      Number(input.slice(0, 4)),
      Number(input.slice(5, 7)) - 1,
      Number(input.slice(8, 10)),
    );
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(input)) {
    return new Date(`${input.replace(" ", "T")}Z`);
  }
  return new Date(input);
}

/** Local "YYYY-MM-DD" of a date */
export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface RelativeParts {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

/**
 * The original's buckets as a signed amount (negative = past):
 * under 45 s → 0 seconds, … under 26 days → days, under 320 days → months.
 */
export function relativeParts(
  input: string | number | Date,
  now: number = Date.now(),
): RelativeParts | null {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Math.round((date.getTime() - now) / 1000);
  const sign = diff < 0 ? -1 : 1;
  const sec = Math.abs(diff);
  const parts = (value: number, unit: Intl.RelativeTimeFormatUnit) => ({
    value: value === 0 ? 0 : sign * value,
    unit,
  });
  if (sec < 45) return parts(0, "second");
  if (sec < 90) return parts(1, "minute");
  if (sec < MINUTE * 45) return parts(Math.round(sec / MINUTE), "minute");
  if (sec < MINUTE * 90) return parts(1, "hour");
  if (sec < HOUR * 22) return parts(Math.round(sec / HOUR), "hour");
  if (sec < HOUR * 36) return parts(1, "day");
  if (sec < DAY * 26) return parts(Math.round(sec / DAY), "day");
  if (sec < DAY * 45) return parts(1, "month");
  if (sec < DAY * 320) return parts(Math.round(sec / (DAY * 30)), "month");
  if (sec < DAY * 548) return parts(1, "year");
  return parts(Math.round(sec / (DAY * 365)), "year");
}

/** "vor 3 Tagen", "yesterday", "in 2 months" in `language` */
export function relativeTime(
  input: string | number | Date | null | undefined,
  language: string,
  now: number = Date.now(),
): string {
  if (input == null || input === "") return "";
  const parts = relativeParts(input, now);
  if (!parts) return "";
  return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
    parts.value,
    parts.unit,
  );
}

/** "4. Mai 2026" / "May 4, 2026" */
export function shortDate(
  input: string | number | Date | null | undefined,
  language: string,
): string {
  if (input == null || input === "") return "";
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
