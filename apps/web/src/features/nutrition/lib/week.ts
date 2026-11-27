export type WeekStatus = "future" | "none" | "over" | "under" | "on";

/** How a day of the week strip went: ±10% of its goal counts as on target */
export function weekStatus(
  date: string,
  today: string,
  kcal: number,
  goalKcal: number,
): WeekStatus {
  if (date > today) return "future";
  if (kcal <= 0 || goalKcal <= 0) return "none";
  if (kcal > goalKcal * 1.1) return "over";
  if (kcal < goalKcal * 0.9) return "under";
  return "on";
}
