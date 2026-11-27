/**
 * What the statistics screen computes itself, after
 * backends/lifttrace/src/routes/Statistics.svelte. Totals, records and
 * streaks come from the server.
 */
import { toText } from "./searchText";
import {
  type CalorieProfile,
  estimateWorkoutCalories,
  fmtSetDuration,
  isTimedSet,
  setVolume,
  type WorkoutExercise,
} from "./workout";

export const RANGES = ["1W", "1M", "3M", "6M", "1Y", "All"] as const;
export type Range = (typeof RANGES)[number];

export const RANGE_DAYS: Record<Range, number | null> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  All: null,
};

/** The range of a link such as `?range=1W` (the weekly summary's); else 1M */
export function parseRange(value: string | null | undefined): Range {
  return (RANGES as readonly string[]).includes(value ?? "")
    ? (value as Range)
    : "1M";
}

/** A date as its local "YYYY-MM-DD" */
export function localDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function daysAgo(days: number, now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return localDay(date);
}

/** "All" starts at the first workout, or 2000-01-01 without one */
export function rangeStart(
  range: Range,
  earliest: string | null,
  now: Date = new Date(),
): string {
  const days = RANGE_DAYS[range];
  return days === null ? (earliest ?? "2000-01-01") : daysAgo(days, now);
}

/** A workout row of GET /workout/recent */
export interface RecentWorkout {
  id?: number;
  date: string;
  completed?: number | boolean | null;
  duration_min?: number | null;
  exercises?: WorkoutExercise[] | string | null;
}

export function exercisesOf(workout: RecentWorkout): WorkoutExercise[] {
  const { exercises } = workout;
  if (typeof exercises !== "string") return exercises ?? [];
  try {
    const parsed = JSON.parse(exercises || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as WorkoutExercise[]) : [];
  } catch {
    return [];
  }
}

/** A day counts only with a completed set, as the Diary's dots do */
export function hasCompletedSet(workout: RecentWorkout): boolean {
  return exercisesOf(workout).some((exercise) =>
    (exercise.sets ?? []).some((set) => set.completed),
  );
}

/** Empty workouts (everything removed) are no workouts */
export function withExercises(workouts: RecentWorkout[]): RecentWorkout[] {
  return workouts.filter((workout) => exercisesOf(workout).length > 0);
}

export function workoutDays(workouts: RecentWorkout[]): Set<string> {
  return new Set(workouts.filter(hasCompletedSet).map((w) => w.date));
}

/** The last `count` days up to today, oldest first */
export function lastDays(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => daysAgo(count - 1 - i, now));
}

/** This week's finished workouts against the goal; weeks start Monday */
export function weekGoal(
  workouts: RecentWorkout[],
  goalSetting: number | null | undefined,
  now: Date = new Date(),
): { count: number; goal: number; fraction: number } {
  const goal = goalSetting || 4;
  const monday = daysAgo((now.getDay() + 6) % 7, now);
  const today = localDay(now);
  const count = workouts.filter(
    (w) =>
      Boolean(w.completed) &&
      hasCompletedSet(w) &&
      w.date >= monday &&
      w.date <= today,
  ).length;
  return { count, goal, fraction: Math.min(1, count / goal) };
}

export interface PeriodDeltas {
  volumePercent: number | null;
  countPercent: number;
  priorCount: number;
}

/** Volume and sessions against the window of the same length before */
export function periodDeltas(
  workouts: RecentWorkout[],
  range: Range,
  start: string,
  current: { volume: number; workouts: number; hasVolume: boolean },
): PeriodDeltas | null {
  const days = RANGE_DAYS[range];
  if (!days || !workouts.length || !current.hasVolume) return null;
  const startDate = new Date(`${start}T12:00:00`);
  const priorEnd = daysAgo(1, startDate);
  const priorStart = daysAgo(days, startDate);
  const prior = workouts.filter(
    (w) => Boolean(w.completed) && w.date >= priorStart && w.date <= priorEnd,
  );
  if (!prior.length) return null;
  let priorVolume = 0;
  for (const workout of prior) {
    for (const exercise of exercisesOf(workout)) {
      for (const set of exercise.sets ?? []) {
        if (!set.completed || set.warmup || isTimedSet(exercise, set)) continue;
        priorVolume += setVolume(set, exercise.load_type || "bilateral");
      }
    }
  }
  const percent = (now: number, then: number) =>
    Math.round(((now - then) / then) * 100);
  return {
    volumePercent: priorVolume ? percent(current.volume, priorVolume) : null,
    countPercent: percent(current.workouts, prior.length),
    priorCount: prior.length,
  };
}

/** Estimated kcal of the range's workouts; null without a full profile */
export function rangeCalories(
  workouts: RecentWorkout[],
  profile: CalorieProfile,
  start: string,
  end: string,
): number | null {
  const { weight_kg: weight, height_cm: height, age } = profile;
  if (!weight || !height || !age || !workouts.length) return null;
  let total = 0;
  for (const workout of workouts) {
    if (workout.date < start || workout.date > end) continue;
    total +=
      estimateWorkoutCalories(
        {
          duration_min: workout.duration_min,
          exercises: exercisesOf(workout),
        },
        profile,
      ) ?? 0;
  }
  return Math.round(total);
}

/** A row of GET /stats/records */
export interface StatRecord {
  exerciseId: number | string;
  name: string;
  maxWeight?: number | null;
  maxReps?: number | null;
  date?: string | null;
  e1rm?: number | null;
  maxDuration?: number | null;
  maxDurationWeight?: number | null;
  durationDate?: string | null;
}

/** "100 kg × 5", or a hold: "1:00" / "1:00 @ 10 kg" */
export function recordValue(record: StatRecord, unit: string): string {
  if ((record.maxDuration ?? 0) > 0 && !((record.maxWeight ?? 0) > 0)) {
    const time = fmtSetDuration(record.maxDuration);
    return record.maxDurationWeight
      ? `${time} @ ${record.maxDurationWeight} ${unit}`
      : time;
  }
  return `${record.maxWeight ?? 0} ${unit} × ${record.maxReps ?? 0}`;
}

/** A timed record's day is in durationDate */
export function recordDay(record: StatRecord): string {
  return record.date || record.durationDate || "";
}

export function recentRecords(records: StatRecord[], limit = 5): StatRecord[] {
  return records
    .filter((record) => recordDay(record))
    .sort((a, b) => recordDay(b).localeCompare(recordDay(a)))
    .slice(0, limit);
}

export const RECORD_CATEGORIES = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "cardio",
  "other",
] as const;
export type RecordCategory = (typeof RECORD_CATEGORIES)[number];

export function groupRecords(
  records: StatRecord[],
  exercises: { id: number; name: string; category?: string | null }[],
): { category: RecordCategory; records: StatRecord[] }[] {
  const groups = new Map<string, StatRecord[]>();
  for (const record of records) {
    const exercise = exercises.find(
      (e) => e.id === record.exerciseId || e.name === record.name,
    );
    const category = (exercise?.category || "other").toLowerCase();
    const key = (RECORD_CATEGORIES as readonly string[]).includes(category)
      ? category
      : "other";
    const list = groups.get(key);
    if (list) list.push(record);
    else groups.set(key, [record]);
  }
  return RECORD_CATEGORIES.filter((c) => groups.has(c)).map((category) => ({
    category,
    records: (groups.get(category) ?? []).sort(
      (a, b) => (b.maxWeight ?? 0) - (a.maxWeight ?? 0),
    ),
  }));
}

/** A session of GET /stats/progress/:exerciseId */
export interface ProgressPoint {
  date: string;
  maxWeight?: number | null;
  maxDuration?: number | null;
  sets?: number | null;
  avgRpe?: number | null;
}

export interface ProgressSeries {
  isTimed: boolean;
  /** Only the sessions of the latest session's kind */
  points: { date: string; value: number; rpe: number | null; sets: number }[];
  stats: { min: number; max: number; average: number } | null;
}

/** Judged by the latest session, so a switch to Time charts the holds */
export function progressSeries(data: ProgressPoint[]): ProgressSeries {
  const isTimed = (data.at(-1)?.maxDuration ?? 0) > 0;
  const points = data
    .map((p) => ({
      date: p.date,
      value: (isTimed ? p.maxDuration : p.maxWeight) ?? 0,
      rpe: p.avgRpe ?? null,
      sets: p.sets ?? 0,
    }))
    .filter((p) => p.value > 0);
  const values = points.map((p) => p.value);
  return {
    isTimed,
    points,
    stats: values.length
      ? {
          min: Math.min(...values),
          max: Math.max(...values),
          average: Math.round(
            values.reduce((a, b) => a + b, 0) / values.length,
          ),
        }
      : null,
  };
}

/** Days since the epoch, in UTC so a DST change can't shift a point */
export function dayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / 86400000;
}

export interface DatedValue {
  date: string;
  value: number;
}

/** The time axis all series share; null without a valid day */
export function dayDomain(
  ...series: DatedValue[][]
): { from: number; until: number } | null {
  const days = series
    .flat()
    .map((p) => dayNumber(p.date))
    .filter(Number.isFinite);
  return days.length
    ? { from: Math.min(...days), until: Math.max(...days) }
    : null;
}

/**
 * A series on the shared date axis, with its own value scale: the points sit
 * over their days, padded by `pad` (a share of the spread, 2 when flat).
 */
export function datedLine(
  series: DatedValue[],
  pad = 0.05,
): { points: { x: number; value: number }[]; min: number; max: number } {
  const valid = series.filter((p) => Number.isFinite(dayNumber(p.date)));
  const values = valid.map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const padding = max > min ? (max - min) * pad : 2;
  return {
    points: valid.map((p) => ({ x: dayNumber(p.date), value: p.value })),
    min: min - padding,
    max: max + padding,
  };
}

/** A body_stats_log row of GET /body-stats/range */
export interface BodyStatsRow {
  date: string;
  stats?: Record<string, unknown> | null;
}

/** One measurement over time, oldest first; days without it are left out */
export function measurementSeries(
  rows: BodyStatsRow[],
  key: string,
): DatedValue[] {
  return rows
    .map((row) => ({
      date: row.date,
      value: parseFloat(toText(row.stats?.[key])),
    }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const OVERLAY_MEASUREMENTS = [
  "bodyFat",
  "neck",
  "chest",
  "waist",
  "hips",
  "biceps",
  "thighs",
  "calves",
] as const;
export type Measurement = (typeof OVERLAY_MEASUREMENTS)[number];

/** "%" for body fat; lengths in cm with kg, else inches */
export function measurementUnit(key: Measurement, weightUnit: string): string {
  if (key === "bodyFat") return "%";
  return weightUnit === "kg" ? "cm" : "in";
}

export function weightSummary(series: DatedValue[]) {
  const first = series.at(0);
  const last = series.at(-1);
  if (!first || !last) return null;
  const values = series.map((p) => p.value);
  return {
    current: last.value,
    min: Math.min(...values),
    max: Math.max(...values),
    change: last.value - first.value,
  };
}

export function cardioSummary(
  weekly: { week: string; minutes: number }[],
  goal: number,
) {
  const minutes = weekly.map((w) => w.minutes);
  const total = minutes.reduce((a, b) => a + b, 0);
  return {
    total,
    peak: minutes.length ? Math.max(...minutes) : 0,
    average: minutes.length ? Math.round(total / minutes.length) : 0,
    weeksOnTarget: goal > 0 ? minutes.filter((m) => m >= goal).length : 0,
  };
}

/** The weekday with the most workouts; on a tie the later one */
export function mostActiveDay(
  distribution: { day: number; count: number }[],
): number | null {
  if (!distribution.some((d) => d.count > 0)) return null;
  return distribution.reduce((best, d) => (d.count >= best.count ? d : best))
    .day;
}

/** 12 → "12", 4800 → "4.8k", 1234567 → "1.2M" */
export function compactVolume(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** "2026-03-09" → "03-09", as the weekly bars are labelled */
export function weekLabel(week: string): string {
  return week.slice(5);
}
