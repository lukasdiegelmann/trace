/** YYYY-MM-DD in local time */
export function isoDate(date: Date): string {
  return date.toLocaleDateString("sv-SE");
}

/** The day `months` months before `now`; a shorter month ends on its last day */
export function monthsAgo(months: number, now: Date = new Date()): string {
  const target = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(now.getDate(), lastDay));
  return isoDate(target);
}
