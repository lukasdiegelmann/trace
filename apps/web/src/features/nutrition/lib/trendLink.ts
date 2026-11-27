/** Links from a goal or the diary to its trend on the Statistics screen */
import { GOAL_BODY_STATS, isWellnessGoal } from "./goals";
import { STATS_METRIC_OF } from "./insights/wellness";
import { nutrientById } from "./nutrition";

function statisticsPath(metric: string): string {
  return `/nutrition/statistics?metric=${encodeURIComponent(metric)}&range=1M`;
}

/** Null where Statistics has no series for the stat */
export function trendPath(statId: string): string | null {
  if (statId === "water") return statisticsPath("water");
  if (isWellnessGoal(statId)) {
    const metric = STATS_METRIC_OF[statId];
    return metric ? statisticsPath(metric) : null;
  }
  const isBodyStat = (GOAL_BODY_STATS as readonly string[]).includes(statId);
  return isBodyStat || nutrientById(statId) ? statisticsPath(statId) : null;
}
