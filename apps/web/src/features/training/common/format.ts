/** A stored day ("2026-03-09") in the app's language; as is when invalid */
export function formatDay(
  day: string,
  language: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
): string {
  const date = new Date(`${day.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? day
    : new Intl.DateTimeFormat(language, options).format(date);
}
