/**
 * What the assistant derives from the whole diary: the logging streak and the
 * averages of a period (Trace.svelte `get_logging_streak`,
 * `get_diary_averages`).
 */
/* eslint-disable @typescript-eslint/naming-convention -- the tools' result keys */
import type { DiaryDay } from "../api";
import { readBodyStat } from "../lib/bodyStats";
import { addDays, localDateStr } from "../lib/dates";
import { dayTotals, normalizeDay, waterTotal } from "../lib/diary";

/** Rows as the list sends them, with every part in place */
function normalized(days: DiaryDay[]): DiaryDay[] {
  return days.map((day) => normalizeDay(day, day.date));
}

/** Anything recorded counts: food, water, body stats or a note */
function hasContent(day: DiaryDay): boolean {
  return (
    day.items.length > 0 ||
    day.water.length > 0 ||
    Object.keys(day.body_stats).length > 0 ||
    day.notes.trim().length > 0
  );
}

export interface LoggingStreak {
  streak_days: number;
  streak_start: string | null;
  streak_end: string | null;
  today_logged: boolean;
  total_logged_days_in_history: number;
  earliest_logged_date: string | null;
  latest_logged_date: string | null;
}

/**
 * Consecutive logged days back from today, or from yesterday while today is
 * still empty
 */
export function loggingStreak(
  days: DiaryDay[],
  now: Date = new Date(),
): LoggingStreak {
  const logged = new Set(
    normalized(days)
      .filter(hasContent)
      .map((day) => day.date),
  );
  const today = localDateStr(now);
  const isTodayLogged = logged.has(today);
  let cursor = isTodayLogged ? today : addDays(today, -1);
  let count = 0;
  let start: string | null = null;
  let end: string | null = null;
  while (logged.has(cursor)) {
    end ??= cursor;
    start = cursor;
    count++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...logged].sort();
  return {
    streak_days: count,
    streak_start: start,
    streak_end: end,
    today_logged: isTodayLogged,
    total_logged_days_in_history: sorted.length,
    earliest_logged_date: sorted[0] ?? null,
    latest_logged_date: sorted.at(-1) ?? null,
  };
}

/** Ten years: a guard against an absurd `days`, not a limit anyone reaches */
const MAX_PERIOD_DAYS = 3650;

/** Over the `days` days before today; only days with food count */
export function diaryAverages(
  days: DiaryDay[],
  requested: unknown,
  now: Date = new Date(),
) {
  const period = Math.min(
    Math.max(parseInt(String(requested), 10) || 28, 1),
    MAX_PERIOD_DAYS,
  );
  const today = localDateStr(now);
  const from = addDays(today, -period);
  const matching = normalized(days)
    .filter((day) => day.date >= from && day.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const sums = {
    calories: 0,
    proteins: 0,
    carbohydrates: 0,
    fat: 0,
    water: 0,
  };
  let daysLogged = 0;
  let first: { date: string; kg: number } | null = null;
  let last: { date: string; kg: number } | null = null;
  for (const day of matching) {
    if (day.items.length === 0) continue;
    daysLogged++;
    const totals = dayTotals(day.items);
    sums.calories += totals.calories || 0;
    sums.proteins += totals.proteins || 0;
    sums.carbohydrates += totals.carbohydrates || 0;
    sums.fat += totals.fat || 0;
    sums.water += waterTotal(day.water);
    // In kg, so a unit switched mid-period doesn't skew the difference
    const kg = readBodyStat(day.body_stats, "weight", "kg", "in");
    if (kg != null) {
      first ??= { date: day.date, kg };
      last = { date: day.date, kg };
    }
  }
  if (daysLogged === 0) {
    return { error: "No diary data found for this period." };
  }
  const average = (sum: number) => Math.round(sum / daysLogged);
  const change = first && last ? last.kg - first.kg : 0;
  return {
    period_days: period,
    days_logged: daysLogged,
    consistency_pct: Math.round((daysLogged / period) * 100),
    averages: {
      calories: average(sums.calories),
      protein_g: average(sums.proteins),
      carbs_g: average(sums.carbohydrates),
      fat_g: average(sums.fat),
      water_ml: average(sums.water),
    },
    ...(first && last && first.date !== last.date
      ? {
          weight_change: {
            from_date: first.date,
            to_date: last.date,
            change_kg: Math.round(change * 100) / 100,
            change_lbs: Math.round(change * 2.20462 * 100) / 100,
            direction: change < -0.1 ? "down" : change > 0.1 ? "up" : "stable",
          },
        }
      : {}),
  };
}
