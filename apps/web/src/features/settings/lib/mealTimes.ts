/** The old UI's times for meals that have none yet */
export const DEFAULT_MEAL_TIMES = [
  "08:00",
  "12:00",
  "18:00",
  "15:00",
  "10:00",
  "20:00",
];

/** `notifMealTimes`, one entry per meal, gaps filled with the defaults */
export function mealTimesFor(count: number, stored: unknown): string[] {
  const list = Array.isArray(stored) ? (stored as unknown[]) : [];
  return Array.from({ length: count }, (_, index) => {
    const value = list[index];
    return typeof value === "string" && value
      ? value
      : (DEFAULT_MEAL_TIMES[index] ?? "12:00");
  });
}

export function setMealTime(
  times: readonly string[],
  index: number,
  value: string,
): string[] {
  return times.map((time, i) => (i === index ? value : time));
}
