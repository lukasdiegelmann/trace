/** "3 hours ago" in the UI's language */
export function relativeTime(
  time: number | string | Date,
  language: string,
  now: number = Date.now(),
): string {
  const at = toTime(time);
  if (Number.isNaN(at)) return "";
  const seconds = Math.round((at - now) / 1000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(seconds, "second");
}

/**
 * The backends write SQLite's UTC "YYYY-MM-DD HH:MM:SS" without a zone;
 * read it as UTC, and ISO strings as they are.
 */
export function toTime(value: number | string | Date): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return Date.parse(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
}

export function formatDateTime(
  value: number | string | Date,
  language: string,
): string {
  const at = toTime(value);
  return Number.isNaN(at)
    ? ""
    : new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(at);
}
