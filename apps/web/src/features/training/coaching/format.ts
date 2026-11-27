import type { TFunction } from "i18next";

import {
  activityRelative,
  relativeDay,
} from "@/features/training/lib/coaching";

/** "just now", "5m ago", ... or a date */
export function relativeTimeText(
  occurred: string | null | undefined,
  t: TFunction<"training">,
  language: string,
): string {
  const relative = activityRelative(occurred);
  if (!relative) return "";
  if (relative.unit === "date")
    return relative.date.toLocaleDateString(language);
  if (relative.unit === "justNow") return t("coaching.time.justNow");
  return t(`coaching.time.${relative.unit}`, { n: relative.n });
}

/** "today", "3d ago", ... of a workout's day */
export function relativeDayText(
  day: string | null | undefined,
  t: TFunction<"training">,
  language: string,
): string {
  const relative = relativeDay(day);
  if (relative.unit === "date")
    return relative.date.toLocaleDateString(language);
  if (relative.unit === "days" || relative.unit === "weeks") {
    return t(`coaching.time.${relative.unit}`, { n: relative.n });
  }
  return t(`coaching.time.${relative.unit}`);
}
