/**
 * Dates as the user's `dateFormat` setting has them, ported from
 * cooktrace/src/lib/format.js.
 */
function parseTimestamp(input: string): Date | null {
  // SQLite's naive "YYYY-MM-DD HH:MM:SS" is UTC.
  const text = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(input)
    ? `${input.replace(" ", "T")}Z`
    : input;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `ISO`, `US`, `EU`, else the long form of the UI language */
export function formatDate(
  input: string | null | undefined,
  format: string,
  language: string,
): string {
  if (!input) return "";
  const date = parseTimestamp(input);
  if (!date) return "";
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  if (format === "ISO") return `${year}-${month}-${day}`;
  if (format === "US") return `${month}/${day}/${year}`;
  if (format === "EU") return `${day}/${month}/${year}`;
  return date.toLocaleDateString(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Relative for the last 7 days, then the date */
export function formatUpdated(
  input: string | null | undefined,
  format: string,
  language: string,
  now: number = Date.now(),
): string {
  if (!input) return "";
  const date = parseTimestamp(input);
  if (!date) return "";
  const seconds = (now - date.getTime()) / 1000;
  if (seconds >= 7 * 86400) return formatDate(input, format, language);
  const relative = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (seconds < 60) return relative.format(0, "second");
  if (seconds < 3600) {
    return relative.format(-Math.round(seconds / 60), "minute");
  }
  if (seconds < 86400) {
    return relative.format(-Math.round(seconds / 3600), "hour");
  }
  return relative.format(-Math.round(seconds / 86400), "day");
}

/** A version's time of day, 12 or 24 hours as set */
export function formatTime(
  input: string | null | undefined,
  timeFormat: string,
  language: string,
): string {
  if (!input) return "";
  const date = parseTimestamp(input);
  return date
    ? date.toLocaleTimeString(language, {
        hour: "numeric",
        minute: "2-digit",
        hour12: timeFormat !== "24h",
      })
    : "";
}

/** "https://www.seriouseats.com/x" as "seriouseats.com" */
export function domainFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol)
      ? parsed.hostname.replace(/^www\./, "")
      : "";
  } catch {
    return "";
  }
}

/** Local "YYYY-MM-DD" */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
