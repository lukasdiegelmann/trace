/** Calendar dates as `YYYY-MM-DD` in the local time zone */

export function localDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

/** Noon, so a DST switch never moves it to another day */
export function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return localDateStr(date);
}

/** Sunday to Saturday around `value`, as the old week strip shows it */
export function weekOf(value: string): string[] {
  const date = parseIsoDate(value);
  const sunday = addDays(value, -date.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(sunday, index));
}

export type DateFormat = "ISO" | "US" | "EU" | "natural";

/** A date as the `dateFormat` setting wants it (Diary's formatDateSub) */
export function formatDateSetting(
  value: string,
  format: DateFormat,
  locale: string,
): string {
  const [year, month, day] = value.split("-");
  switch (format) {
    case "ISO":
      return value;
    case "US":
      return `${month}/${day}/${year}`;
    case "EU":
      return `${day}.${month}.${year}`;
    default:
      return parseIsoDate(value).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
  }
}

/** A clock time as the `timeFormat` setting wants it */
export function formatTimeSetting(
  date: Date,
  format: "12h" | "24h",
  locale: string,
): string {
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: format === "12h",
  });
}

/** SQLite's UTC `YYYY-MM-DD HH:MM:SS` (or ISO) as a Date */
export function parseServerTimestamp(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }
  return new Date(value);
}
