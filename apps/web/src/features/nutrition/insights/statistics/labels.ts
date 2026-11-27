import type { Translate } from "../useInsightsT";

/** Units that are words (the rest, like "g" or "bpm", are the same in every language) */
const WORD_UNITS = new Set(["steps", "hr", "floors", "yrs", "brpm"]);

export function unitLabel(unit: string, t: Translate): string {
  return WORD_UNITS.has(unit) ? t(`units.${unit}`) : unit;
}

export function metricLabel(key: string, t: Translate): string {
  return t(`metrics.${key}`);
}
