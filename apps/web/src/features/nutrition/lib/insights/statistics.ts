/**
 * The Statistics page's logic, ported from
 * nutritrace/src/routes/Statistics.svelte and routes/settings/Statistics.svelte.
 * Pure: the page fetches, these functions shape.
 */
import { BODY_STAT_KEYS, isBodyStatKey, readBodyStat } from "./bodyStats";
import { addDays, daysBetween, lastDays, localDateStr } from "./dates";
import { goalValueForMetric, isMinimumGoal, type Goals } from "./goals";
import {
  calculateItem,
  isNutriment,
  kcalToKj,
  NUTRIMENTS,
  sumNutrition,
  type DiaryItemLike,
} from "./nutrition";

export type MetricGroup = "nutrient" | "body" | "water" | "wellness";

export interface StatsMetric {
  key: string;
  group: MetricGroup;
}

/** Wellness series Statistics can plot, and where they come from */
export interface WellnessStatsMetric {
  key: string;
  /** `fitgarm`: Garmin, then the fitbit family; `withings`: Withings first */
  source: "fitgarm" | "withings";
  field: string;
}

export const WELLNESS_STATS_METRICS: readonly WellnessStatsMetric[] = [
  { key: "wl_steps", source: "fitgarm", field: "steps" },
  { key: "wl_active", source: "fitgarm", field: "active_minutes" },
  { key: "wl_sleep", source: "fitgarm", field: "sleep_duration_min" },
  { key: "wl_rhr", source: "fitgarm", field: "resting_hr" },
  { key: "wl_hrv", source: "fitgarm", field: "hrv_daily_rmssd" },
  { key: "wl_spo2", source: "fitgarm", field: "spo2_avg" },
  { key: "wl_muscle", source: "withings", field: "muscle_mass_kg" },
];

/** Which integrations are on (settings), as Statistics gates on them */
export interface Integrations {
  isFitbitFamilyEnabled: boolean;
  isGarminEnabled: boolean;
  isWithingsEnabled: boolean;
}

export interface MetricListOptions extends Integrations {
  hiddenBodyStats: readonly string[];
  isWaterShownInStats: boolean;
  /** `wellnessMetrics`: null = every wellness metric visible */
  wellnessMetrics: readonly string[] | null;
}

function isWellnessFieldVisible(
  wellnessMetrics: readonly string[] | null,
  field: string,
): boolean {
  return wellnessMetrics == null || wellnessMetrics.includes(field);
}

/** The wellness series available with the integrations that are on */
export function availableWellnessMetrics(
  options: Omit<MetricListOptions, "hiddenBodyStats" | "isWaterShownInStats">,
): WellnessStatsMetric[] {
  const hasWellness = options.isFitbitFamilyEnabled || options.isGarminEnabled;
  return WELLNESS_STATS_METRICS.filter((m) => {
    if (!isWellnessFieldVisible(options.wellnessMetrics, m.field)) return false;
    if (m.key === "wl_muscle") {
      return options.isWithingsEnabled || options.isFitbitFamilyEnabled;
    }
    return hasWellness;
  });
}

/** Every metric the page can show before the user's hide list and order */
export function availableMetrics(options: MetricListOptions): StatsMetric[] {
  return [
    ...NUTRIMENTS.filter((n) => n.isDefault).map((n): StatsMetric => ({
      key: n.id,
      group: "nutrient",
    })),
    ...BODY_STAT_KEYS.filter((k) => !options.hiddenBodyStats.includes(k)).map(
      (k): StatsMetric => ({ key: k, group: "body" }),
    ),
    ...(options.isWaterShownInStats
      ? [{ key: "water", group: "water" } satisfies StatsMetric]
      : []),
    ...availableWellnessMetrics(options).map((m): StatsMetric => ({
      key: m.key,
      group: "wellness",
    })),
  ];
}

/** The user's order first, metrics not in it appended (settings/Statistics) */
export function orderMetrics<T extends { key: string }>(
  metrics: readonly T[],
  order: readonly string[],
): T[] {
  if (!order.length) return [...metrics];
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const sorted = order
    .map((key) => byKey.get(key))
    .filter((m): m is T => m !== undefined);
  const rest = metrics.filter((m) => !order.includes(m.key));
  return [...sorted, ...rest];
}

/** What the picker shows: hidden metrics dropped, then the user's order */
export function visibleMetrics(
  options: MetricListOptions,
  hidden: readonly string[],
  order: readonly string[],
): StatsMetric[] {
  const visible = availableMetrics(options).filter(
    (m) => !hidden.includes(m.key),
  );
  return orderMetrics(visible, order);
}

/** The picker's metrics in the rail's groups, empty groups left out */
export function groupMetrics(
  metrics: readonly StatsMetric[],
): { group: MetricGroup; metrics: StatsMetric[] }[] {
  const groups: MetricGroup[] = ["nutrient", "body", "water", "wellness"];
  return groups
    .map((group) => ({
      group,
      metrics: metrics.filter((m) => m.group === group),
    }))
    .filter((g) => g.metrics.length > 0);
}

/**
 * The metric the page opens on: the first of the user's order that is
 * neither hidden nor unavailable, else the energy metric (#155).
 */
export function initialMetric(
  order: readonly string[],
  hidden: readonly string[],
  available: readonly StatsMetric[],
  energyUnit: string,
): string {
  const first = order.find(
    (key) =>
      key && !hidden.includes(key) && available.some((m) => m.key === key),
  );
  if (first) return first;
  return energyUnit === "kJ" ? "kilojoules" : "calories";
}

/** Accumulate over the day: today is partial until it ends */
export function isCumulative(metric: string): boolean {
  if (isNutriment(metric)) return true;
  return ["water", "water_ml", "wl_steps", "wl_active"].includes(metric);
}

/** 0 is no meaningful baseline here: the Y axis auto-fits (#67) */
const PHYSIOLOGICAL_METRICS = new Set<string>([
  ...BODY_STAT_KEYS,
  "wl_sleep",
  "wl_rhr",
  "wl_hrv",
  "wl_spo2",
  "wl_muscle",
]);

export function isPhysiologicalMetric(metric: string): boolean {
  return PHYSIOLOGICAL_METRICS.has(metric);
}

export interface UnitSettings {
  energyUnit: string;
  weightUnit: string;
  lengthUnit: string;
  waterUnit: string;
}

/** The unit a metric is shown in */
export function metricUnit(metric: string, units: UnitSettings): string {
  if (metric === "water") return units.waterUnit;
  if (metric === "calories") return units.energyUnit || "kcal";
  if (metric === "wl_muscle") return units.weightUnit === "lb" ? "lbs" : "kg";
  const wellnessUnits: Record<string, string> = {
    wl_steps: "steps",
    wl_active: "min",
    wl_sleep: "hr",
    wl_rhr: "bpm",
    wl_hrv: "ms",
    wl_spo2: "%",
  };
  if (metric in wellnessUnits) return wellnessUnits[metric];
  if (metric === "weight") return units.weightUnit || "lb";
  if (metric === "body_fat" || metric === "body_water") return "%";
  if (isBodyStatKey(metric)) return units.lengthUnit || "in";
  return NUTRIMENTS.find((n) => n.id === metric)?.unit ?? "";
}

export const RANGES = ["7", "14", "30", "90", "180", "365", "all"] as const;
export type FixedRange = (typeof RANGES)[number];
export type Range = FixedRange | "custom";

export function isRange(value: string | null | undefined): value is Range {
  return (
    value === "custom" || (RANGES as readonly string[]).includes(value ?? "")
  );
}

/**
 * Wellness and device body metrics have no diary to bound "all": they use
 * the last 365 days.
 */
export function isDeviceMetric(metric: string, integrations: Integrations) {
  const isWellness = metric.startsWith("wl_");
  const isBodyDevice =
    ((metric === "weight" || metric === "body_fat") &&
      (integrations.isWithingsEnabled || integrations.isFitbitFamilyEnabled)) ||
    (metric === "body_water" && integrations.isWithingsEnabled);
  return { isWellness, isBodyDevice };
}

/**
 * The days a range covers, oldest first; null when a custom range is
 * incomplete or backwards. `diaryDays` are the days with a diary row
 * (for "all").
 */
export function rangeDays(
  range: Range,
  options: {
    today?: string;
    customStart?: string;
    customEnd?: string;
    isDeviceSeries: boolean;
    diaryDays: readonly string[];
  },
): string[] | null {
  const today = options.today ?? localDateStr();
  if (range === "all") {
    if (options.isDeviceSeries) return lastDays(365, today);
    return [...new Set(options.diaryDays)].sort();
  }
  if (range === "custom") {
    const { customStart, customEnd } = options;
    if (!customStart || !customEnd || customStart > customEnd) return null;
    return daysBetween(customStart, customEnd);
  }
  return lastDays(Number.parseInt(range, 10), today);
}

/** The quick picks of a custom range */
export type QuickRange =
  "last7" | "last30" | "last90" | "thisMonth" | "lastMonth" | "yearToDate";

export function quickRange(
  pick: QuickRange,
  today: string = localDateStr(),
): { start: string; end: string } {
  const [year, month] = today.split("-").map(Number);
  switch (pick) {
    case "last7":
      return { start: addDays(today, -6), end: today };
    case "last30":
      return { start: addDays(today, -29), end: today };
    case "last90":
      return { start: addDays(today, -89), end: today };
    case "thisMonth":
      return { start: `${today.slice(0, 7)}-01`, end: today };
    case "lastMonth": {
      const first = new Date(year, month - 2, 1);
      const last = new Date(year, month - 1, 0);
      return { start: localDateStr(first), end: localDateStr(last) };
    }
    case "yearToDate":
      return { start: `${year}-01-01`, end: today };
  }
}

export interface DayValue {
  date: string;
  /** null: nothing logged that day */
  val: number | null;
}

/** A diary row of `GET /api/diary` (what Statistics reads) */
export interface DiaryDay {
  date: string;
  items?: DiaryItemLike[] | null;
  water?: { amount?: number | null }[] | null;
  body_stats?: Record<string, unknown> | null;
  bodyStats?: Record<string, unknown> | null;
  completed_at?: string | null;
}

/** The diary rows by day */
export type DiaryByDate = Partial<Record<string, DiaryDay>>;

/** `GET /api/wellness/{fitbit,garmin}/data`: day → metric → value */
export type WellnessByDate = Partial<
  Record<string, Partial<Record<string, number | null>>>
>;
/** `GET /api/wellness/withings/data`: day → metric → { value } */
export type WithingsByDate = Partial<
  Record<string, Partial<Record<string, { value: number | null }>>>
>;

export interface SeriesSources {
  diary: DiaryByDate;
  fitbit: WellnessByDate;
  garmin: WellnessByDate;
  withings: WithingsByDate;
}

export interface SeriesOptions extends UnitSettings, Integrations {
  isTodayIncluded: boolean;
  today?: string;
}

const LB_PER_KG = 2.20462;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** One day's value of a diary metric (nutrient, water or body stat) */
function diaryValue(
  entry: DiaryDay | undefined,
  metric: string,
  options: SeriesOptions,
): number | null {
  if (!entry) return null;
  if (metric === "water") {
    const total = (entry.water ?? []).reduce(
      (sum, log) => sum + (log.amount ?? 0),
      0,
    );
    return total > 0 ? total : null;
  }
  if (isBodyStatKey(metric)) {
    const stats = entry.body_stats ?? entry.bodyStats ?? {};
    return readBodyStat(stats, metric, options.weightUnit, options.lengthUnit);
  }
  // A day with food but none of this nutrient counts as 0 (#45); a row
  // without food (e.g. water only) is no data.
  const items = entry.items ?? [];
  if (items.length === 0) return null;
  const totals = sumNutrition(items.map((item) => calculateItem(item)));
  let raw = totals[metric] ?? 0;
  if (metric === "calories" && options.energyUnit === "kJ") raw = kcalToKj(raw);
  return round1(raw);
}

/**
 * The series of one metric over `days`: wellness from the devices,
 * device body metrics device-first with the diary as fallback, the rest
 * from the diary. Today is dropped from cumulative metrics unless asked.
 */
export function buildSeries(
  metric: string,
  days: readonly string[],
  sources: SeriesSources,
  options: SeriesOptions,
): DayValue[] {
  const { isWellness, isBodyDevice } = isDeviceMetric(metric, options);
  let rows: DayValue[];
  const wellness = WELLNESS_STATS_METRICS.find((m) => m.key === metric);

  if (isWellness) {
    if (!wellness) return [];
    rows = days.map((date) => {
      let raw: number | null;
      if (wellness.source === "fitgarm") {
        raw =
          sources.garmin[date]?.[wellness.field] ??
          sources.fitbit[date]?.[wellness.field] ??
          null;
        if (raw != null && wellness.key === "wl_sleep") {
          raw = Math.round(raw / 6) / 10;
        }
      } else {
        raw =
          sources.withings[date]?.[wellness.field]?.value ??
          sources.fitbit[date]?.[wellness.field] ??
          null;
        if (raw != null && options.weightUnit === "lb") raw *= LB_PER_KG;
      }
      return { date, val: raw };
    });
  } else {
    rows = days.map((date) => {
      if (isBodyDevice) {
        const field =
          metric === "weight"
            ? "weight_kg"
            : metric === "body_water"
              ? "body_water_pct"
              : "body_fat_pct";
        const raw =
          sources.withings[date]?.[field]?.value ??
          sources.fitbit[date]?.[field] ??
          null;
        if (raw != null) {
          const val =
            metric === "weight" && options.weightUnit === "lb"
              ? raw * LB_PER_KG
              : raw;
          return { date, val };
        }
      }
      return { date, val: diaryValue(sources.diary[date], metric, options) };
    });
  }

  if (isCumulative(metric) && !options.isTodayIncluded) {
    const today = options.today ?? localDateStr();
    rows = rows.filter((row) => row.date !== today);
  }
  return rows;
}

export function hasValue(row: DayValue): row is { date: string; val: number } {
  return row.val !== null && Number.isFinite(row.val);
}

export interface Summary {
  avg: number;
  min: number;
  max: number;
  total: number;
  daysWithData: number;
}

/** Average, min, max, total and days logged; 0 counts, null doesn't (#45) */
export function summarize(rows: readonly DayValue[]): Summary | null {
  const values = rows.filter(hasValue).map((row) => row.val);
  if (!values.length) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return {
    avg: round1(total / values.length),
    min: round1(Math.min(...values)),
    max: round1(Math.max(...values)),
    total: round1(total),
    daysWithData: values.length,
  };
}

/** The rows the chart shows: empty days kept or dropped (`statsShowEmptyDays`) */
export function displayRows(
  rows: readonly DayValue[],
  isEmptyDayShown: boolean,
): DayValue[] {
  return isEmptyDayShown ? [...rows] : rows.filter(hasValue);
}

/** Least-squares line through the points, rounded to one decimal */
export function linearRegression(
  points: readonly { x: number; y: number }[],
): number[] | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return points.map((p) => round1(slope * p.x + intercept));
}

/**
 * The trend line over the shown values: a regression through the positive
 * values, evaluated at every position (the original draws it across gaps);
 * null with fewer than two positive values.
 */
export function trendLine(values: readonly (number | null)[]): number[] | null {
  const points = values
    .map((v, i) => (v !== null && v > 0 ? { x: i, y: v } : null))
    .filter((p): p is { x: number; y: number } => p !== null);
  const fitted = linearRegression(points);
  if (!fitted) return null;
  const [first, last] = [points[0], points[points.length - 1]];
  const slope = (fitted[fitted.length - 1] - fitted[0]) / (last.x - first.x);
  return values.map((_, i) => round1(fitted[0] + slope * (i - first.x)));
}

/**
 * Where the value axis starts. Zero for zero-locked charts; otherwise a
 * round number just below the lowest value, so day-to-day changes of body
 * stats and vitals stay visible (#67). The chart plots `value - baseline`.
 */
export function chartBaseline(
  values: readonly number[],
  isZeroBased: boolean,
): number {
  if (isZeroBased || !values.length) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rough = (max - min || Math.max(Math.abs(max) * 0.05, 1)) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, factor * magnitude);
  const baseline = Math.floor((min - step / 2) / step) * step;
  return min >= 0 ? Math.max(0, baseline) : baseline;
}

/** Average vs goal in %, rounded; null without a goal or average */
export function goalDelta(
  average: number | null | undefined,
  goal: number | null,
): number | null {
  if (average == null || !goal) return null;
  return Math.round(((average - goal) / goal) * 100);
}

/** Whether a delta is good: floor goals want up, others down */
export function isDeltaGood(delta: number, isMinGoal: boolean): boolean {
  return isMinGoal ? delta >= 0 : delta <= 0;
}

/**
 * Last 7 logged days vs the 7 before (#6), in %; null with fewer than 14
 * logged days.
 */
export function weeklyTrend(rows: readonly DayValue[]): number | null {
  if (rows.length < 14) return null;
  const withValue = rows.filter(hasValue);
  if (withValue.length < 14) return null;
  const average = (list: { val: number }[]) =>
    list.reduce((s, r) => s + r.val, 0) / list.length;
  const last = average(withValue.slice(-7));
  const previous = average(withValue.slice(-14, -7));
  if (previous === 0) return null;
  return Math.round(((last - previous) / Math.abs(previous)) * 100);
}

export interface CompletionStats {
  marked: number;
  total: number;
  pct: number;
  dates: Set<string>;
}

/** Days marked complete in the range (#207) */
export function completionStats(
  days: readonly string[],
  diary: DiaryByDate,
): CompletionStats | null {
  if (!days.length) return null;
  const dates = new Set(days.filter((day) => !!diary[day]?.completed_at));
  return {
    marked: dates.size,
    total: days.length,
    pct: Math.round((dates.size / days.length) * 100),
    dates,
  };
}

export interface MonthGroup {
  key: string;
  count: number;
  /** Newest first */
  entries: { date: string; val: number }[];
}

/** History rows by month, newest month first (#4, ranges above 60 days) */
export function groupByMonth(rows: readonly DayValue[]): MonthGroup[] {
  const map = new Map<string, { date: string; val: number }[]>();
  for (const row of rows) {
    if (!hasValue(row)) continue;
    const key = row.date.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, entries]) => ({
      key,
      count: entries.length,
      entries: [...entries].reverse(),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** The history is grouped by month above this many rows */
export const LONG_RANGE_ROWS = 60;

/** Metrics to suggest on an empty chart (#7) */
export function emptyAlternatives(
  metric: string,
  metrics: readonly StatsMetric[],
): string[] {
  return ["calories", "weight", "wl_steps"]
    .filter((key) => key !== metric)
    .filter((key) => metrics.some((m) => m.key === key))
    .slice(0, 3);
}

/** The CSV export: `Date,Value`, logged days only (#8) */
export function toCsv(rows: readonly DayValue[]): string {
  return [
    "Date,Value",
    ...rows.filter(hasValue).map((r) => `${r.date},${r.val}`),
  ].join("\n");
}

/** The goal line value and direction of a metric */
export function metricGoal(goals: Goals, metric: string, energyUnit: string) {
  return {
    value: goalValueForMetric(goals, metric, energyUnit),
    isMinimum: isMinimumGoal(goals[metric]),
  };
}
