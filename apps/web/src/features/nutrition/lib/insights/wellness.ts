/**
 * The Wellness page's logic, ported from nutritrace/src/routes/Wellness.svelte
 * and components/settings/SettingsWellness.svelte. Labels and texts are
 * i18n keys in the UI; this file only knows ids and numbers.
 */
import { addDays, daysBetween, localDateStr } from "./dates";
import { displayEnergy } from "./nutrition";
import type { WellnessByDate, WithingsByDate } from "./statistics";

export type WellnessSource = "fitbit" | "garmin" | "withings";
export type WellnessTab = "activity" | "sleep" | "heart" | "body";
export type MetricTabGroup = "activity" | "sleep" | "sleep_quality" | "heart";

/** How a value is turned into text */
export type ValueFormat =
  | "round" // Math.round
  | "roundGrouped" // Math.round, with thousands separators
  | "fixed0"
  | "fixed1"
  | "fixed2"
  | "distance"
  | "energy"
  | "sleep" // minutes as "7h 30m"
  | "hoursMinutes" // "1h 5m" / "45m"
  | "skinTemp"
  | "vo2"
  | "weight"
  | "percent1"
  | "bmr"
  | "afib"
  | "raw";

export interface WellnessMetric {
  id: string;
  group: MetricTabGroup;
  unit: string;
  format: ValueFormat;
  sources: WellnessSource[];
  /** Kept for Statistics, no card of its own */
  isTileHidden?: boolean;
  /** Card only on days with a value (#205) */
  isHiddenIfEmpty?: boolean;
}

/** Wellness.svelte ALL_METRICS, in card order */
export const WELLNESS_METRICS: readonly WellnessMetric[] = [
  {
    id: "steps",
    group: "activity",
    unit: "steps",
    format: "roundGrouped",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "distance_km",
    group: "activity",
    unit: "",
    format: "distance",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "floors",
    group: "activity",
    unit: "floors",
    format: "round",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "active_minutes",
    group: "activity",
    unit: "min",
    format: "round",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "calories_out",
    group: "activity",
    unit: "kcal",
    format: "energy",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "active_zone_minutes",
    group: "activity",
    unit: "min",
    format: "round",
    sources: ["fitbit"],
  },
  {
    id: "moderate_intensity_min",
    group: "activity",
    unit: "min",
    format: "round",
    sources: ["garmin"],
  },
  {
    id: "vigorous_intensity_min",
    group: "activity",
    unit: "min",
    format: "round",
    sources: ["garmin"],
  },
  {
    id: "sleep_duration_min",
    group: "sleep",
    unit: "",
    format: "sleep",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "sleep_deep_min",
    group: "sleep",
    unit: "min",
    format: "sleep",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "sleep_light_min",
    group: "sleep",
    unit: "min",
    format: "sleep",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "sleep_rem_min",
    group: "sleep",
    unit: "min",
    format: "sleep",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "sleep_wake_min",
    group: "sleep",
    unit: "min",
    format: "sleep",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "sleep_efficiency",
    group: "sleep",
    unit: "%",
    format: "fixed0",
    sources: ["fitbit"],
  },
  {
    id: "sleep_score",
    group: "sleep",
    unit: "/100",
    format: "round",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "sleep_time_to_fall_asleep_min",
    group: "sleep_quality",
    unit: "min",
    format: "round",
    sources: ["fitbit"],
  },
  {
    id: "sleep_sound_sleep_min",
    group: "sleep_quality",
    unit: "",
    format: "hoursMinutes",
    sources: ["fitbit"],
  },
  {
    id: "sleep_restlessness_min",
    group: "sleep_quality",
    unit: "min",
    format: "round",
    sources: ["fitbit"],
  },
  {
    id: "sleep_interruptions_min",
    group: "sleep_quality",
    unit: "min",
    format: "round",
    sources: ["fitbit"],
  },
  {
    id: "sleep_full_awakenings",
    group: "sleep_quality",
    unit: "",
    format: "round",
    sources: ["fitbit"],
    isTileHidden: true,
  },
  {
    id: "resting_hr",
    group: "heart",
    unit: "bpm",
    format: "round",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "avg_heart_rate",
    group: "heart",
    unit: "bpm",
    format: "round",
    sources: ["fitbit", "garmin"],
    isHiddenIfEmpty: true,
  },
  {
    id: "spo2_avg",
    group: "heart",
    unit: "%",
    format: "fixed1",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "respiratory_rate",
    group: "heart",
    unit: "brpm",
    format: "fixed1",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "hrv_daily_rmssd",
    group: "heart",
    unit: "ms",
    format: "fixed1",
    sources: ["fitbit", "garmin"],
  },
  {
    id: "skin_temp_variation",
    group: "heart",
    unit: "",
    format: "skinTemp",
    sources: ["fitbit"],
  },
  {
    id: "vo2_max",
    group: "heart",
    unit: "",
    format: "vo2",
    sources: ["fitbit"],
  },
  {
    id: "max_hr",
    group: "heart",
    unit: "bpm",
    format: "round",
    sources: ["garmin"],
  },
];

export interface SimpleMetric {
  id: string;
  unit: string;
  format: ValueFormat;
}

/** Withings body composition (Body tab) */
export const BODY_METRICS: readonly SimpleMetric[] = [
  { id: "weight_kg", unit: "", format: "weight" },
  { id: "body_fat_pct", unit: "%", format: "fixed1" },
  { id: "muscle_mass_kg", unit: "", format: "weight" },
  { id: "bone_mass_kg", unit: "", format: "weight" },
  { id: "body_water_pct", unit: "", format: "percent1" },
  { id: "lean_mass_kg", unit: "", format: "weight" },
  { id: "fat_mass_kg", unit: "", format: "weight" },
  { id: "visceral_fat", unit: "", format: "fixed1" },
  { id: "visceral_fat_index", unit: "", format: "fixed1" },
  { id: "extracellular_water_kg", unit: "", format: "weight" },
  { id: "intracellular_water_kg", unit: "", format: "weight" },
];

/** Withings body scan scores (Body tab) */
export const BODY_SCORE_METRICS: readonly SimpleMetric[] = [
  { id: "vascular_age", unit: "yrs", format: "round" },
  { id: "metabolic_age", unit: "yrs", format: "round" },
  { id: "basal_metabolic_rate", unit: "kcal/day", format: "bmr" },
  { id: "nerve_health_score", unit: "/100", format: "round" },
  { id: "eda_feet", unit: "µS", format: "fixed1" },
  { id: "pulse_wave_velocity", unit: "m/s", format: "fixed1" },
  { id: "ecg_heart_rate", unit: "bpm", format: "round" },
  { id: "ecg_afib", unit: "", format: "afib" },
];

/** Garmin's own scores (Heart tab) */
export const GARMIN_METRICS: readonly SimpleMetric[] = [
  { id: "body_battery_high", unit: "", format: "round" },
  { id: "body_battery_low", unit: "", format: "round" },
  { id: "stress_avg", unit: "/100", format: "round" },
];

/** Segmental analysis rows: muscle and lean mass per body part */
export const SEGMENTS = [
  {
    id: "leftArm",
    muscle: "muscle_mass_left_arm_kg",
    lean: "lean_mass_left_arm_kg",
  },
  {
    id: "rightArm",
    muscle: "muscle_mass_right_arm_kg",
    lean: "lean_mass_right_arm_kg",
  },
  { id: "torso", muscle: "muscle_mass_torso_kg", lean: "lean_mass_torso_kg" },
  {
    id: "leftLeg",
    muscle: "muscle_mass_left_leg_kg",
    lean: "lean_mass_left_leg_kg",
  },
  {
    id: "rightLeg",
    muscle: "muscle_mass_right_leg_kg",
    lean: "lean_mass_right_leg_kg",
  },
] as const;

/** Every id the visibility list knows (Wellness.svelte toggleMetric) */
export const ALL_VISIBILITY_IDS: readonly string[] = [
  ...WELLNESS_METRICS.map((m) => m.id),
  "weight_kg",
  "body_fat_pct",
  "muscle_mass_kg",
  "bone_mass_kg",
  "body_water_pct",
  "lean_mass_kg",
  "fat_mass_kg",
  "visceral_fat",
  "visceral_fat_index",
  "extracellular_water_kg",
  "intracellular_water_kg",
  "vascular_age",
  "metabolic_age",
  "basal_metabolic_rate",
  "nerve_health_score",
  "eda_feet",
  "pulse_wave_velocity",
  "ecg_heart_rate",
  "ecg_afib",
  "body_battery_high",
  "body_battery_low",
  "stress_avg",
  "segmental_analysis",
  "active_calories",
  "avg_heart_rate",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "body_temperature",
  "sleep_awake_min",
  "water_ml",
];

/** `wellnessMetrics`: null means every metric is visible */
export function isMetricVisible(
  wellnessMetrics: readonly string[] | null,
  id: string,
): boolean {
  return wellnessMetrics == null || wellnessMetrics.includes(id);
}

/** Turns one metric on or off; from null (all) it starts with `allIds` */
export function toggleMetric(
  wellnessMetrics: readonly string[] | null,
  id: string,
  allIds: readonly string[] = ALL_VISIBILITY_IDS,
): string[] {
  const current = wellnessMetrics ?? allIds;
  return current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
}

export interface EnabledSources {
  isFitbitFamilyEnabled: boolean;
  isGarminEnabled: boolean;
  isWithingsEnabled: boolean;
}

/** One of the metric's sources is on (the fitbit bucket = the fitbit family) */
export function isSourceEnabled(
  metric: { sources?: readonly WellnessSource[] },
  enabled: EnabledSources,
): boolean {
  if (!metric.sources) return true;
  return metric.sources.some(
    (s) =>
      (s === "fitbit" && enabled.isFitbitFamilyEnabled) ||
      (s === "garmin" && enabled.isGarminEnabled) ||
      (s === "withings" && enabled.isWithingsEnabled),
  );
}

/** Wellness metric → Statistics series, for the "view trend" link */
export const STATS_METRIC_OF: Record<string, string> = {
  steps: "wl_steps",
  active_minutes: "wl_active",
  sleep_duration_min: "wl_sleep",
  resting_hr: "wl_rhr",
  hrv_daily_rmssd: "wl_hrv",
  spo2_avg: "wl_spo2",
};

export interface FormatSettings {
  distUnit: string;
  energyUnit: string;
  tempUnit: string;
  weightUnit: string;
  locale: string;
}

export interface FormattedValue {
  value: string;
  unit: string;
}

/** Minutes as { "7h 30m" } / { "45", "min" } / { "8h" } (fmtSleep) */
export function formatSleep(minutes: number): FormattedValue {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return { value: `${m}`, unit: "min" };
  if (m === 0) return { value: `${h}h`, unit: "" };
  return { value: `${h}h ${m}m`, unit: "" };
}

/** fmtSleepStr: one string, "—" for nothing */
export function formatSleepText(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const s = formatSleep(minutes);
  return s.unit ? `${s.value} ${s.unit}` : s.value;
}

/** A number with exactly `digits` decimals, in the language's notation */
export function formatFixed(
  value: number,
  digits: number,
  locale: string,
): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatWeight(
  kg: number,
  weightUnit: string,
  locale: string,
): FormattedValue {
  if (weightUnit === "lb") {
    return { value: formatFixed(kg * 2.20462, 1, locale), unit: "lbs" };
  }
  return { value: formatFixed(kg, 1, locale), unit: "kg" };
}

export function formatDistance(
  km: number,
  distUnit: string,
  locale: string,
): FormattedValue {
  if (distUnit === "mi") {
    return { value: formatFixed(km * 0.621371, 2, locale), unit: "mi" };
  }
  return { value: formatFixed(km, 2, locale), unit: "km" };
}

/**
 * A metric's value as text plus unit; null for no value. `vo2Range` is the
 * device's range string ("39-43"), preferred for cardio fitness.
 */
export function formatMetricValue(
  metric: { id: string; unit: string; format: ValueFormat },
  raw: number | null | undefined,
  settings: FormatSettings,
  vo2Range?: string | null,
): FormattedValue | null {
  if (raw == null) return null;
  const grouped = (n: number) => n.toLocaleString(settings.locale);
  switch (metric.format) {
    case "round":
      return { value: String(Math.round(raw)), unit: metric.unit };
    case "roundGrouped":
      return { value: grouped(Math.round(raw)), unit: metric.unit };
    case "fixed0":
      return { value: formatFixed(raw, 0, settings.locale), unit: metric.unit };
    case "fixed1":
      return { value: formatFixed(raw, 1, settings.locale), unit: metric.unit };
    case "fixed2":
      return { value: formatFixed(raw, 2, settings.locale), unit: metric.unit };
    case "distance":
      return formatDistance(raw, settings.distUnit, settings.locale);
    case "energy": {
      const e = displayEnergy(raw, settings.energyUnit);
      return { value: grouped(e.value), unit: e.unit };
    }
    case "sleep":
      return formatSleep(raw);
    case "hoursMinutes": {
      const h = Math.floor(raw / 60);
      const m = Math.round(raw % 60);
      return { value: h ? `${h}h ${m}m` : `${m}m`, unit: "" };
    }
    case "skinTemp": {
      const isFahrenheit = settings.tempUnit !== "C";
      const v = isFahrenheit ? (raw * 9) / 5 : raw;
      return {
        value: (v >= 0 ? "+" : "") + formatFixed(v, 2, settings.locale),
        unit: isFahrenheit ? "°F" : "°C",
      };
    }
    case "vo2":
      return vo2Range
        ? { value: vo2Range, unit: metric.unit }
        : { value: formatFixed(raw, 1, settings.locale), unit: metric.unit };
    case "weight":
      return formatWeight(raw, settings.weightUnit, settings.locale);
    case "percent1":
      return { value: formatFixed(raw, 1, settings.locale), unit: "%" };
    case "bmr": {
      const e = displayEnergy(raw, settings.energyUnit);
      return { value: grouped(e.value), unit: `${e.unit}/day` };
    }
    case "afib":
      // The UI translates "detected" / "normal"
      return { value: raw === 1 ? "detected" : "normal", unit: "" };
    case "raw":
      return { value: String(raw), unit: metric.unit };
  }
}

export type DayMetrics = Record<string, number | string | null | undefined>;

/**
 * What the page shows for a day: Garmin's values, then the fitbit family's
 * on top (Garmin's measured sleep score wins over Fitbit's estimate), and
 * seeded `*_actual` values over the calculated ones.
 */
export function mergeDisplayData(
  garmin: DayMetrics,
  fitbit: DayMetrics,
  enabled: { isGarminEnabled: boolean; isFitbitFamilyEnabled: boolean },
): DayMetrics {
  const merged: DayMetrics = {};
  if (enabled.isGarminEnabled) {
    for (const [k, v] of Object.entries(garmin)) if (v != null) merged[k] = v;
  }
  if (enabled.isFitbitFamilyEnabled) {
    for (const [k, v] of Object.entries(fitbit)) {
      if (v == null) continue;
      if (k === "sleep_score" && merged[k] != null) continue;
      merged[k] = v;
    }
  }
  for (const key of [
    "sleep_score",
    "readiness_score",
    "stress_score",
    "sleep_duration_min",
  ]) {
    const actual = merged[`${key}_actual`];
    if (actual != null) merged[key] = actual;
  }
  return merged;
}

/** Withings' `{date:{metric:{value}}}` of one day as `{metric: value}` */
export function flattenWithings(
  byDate: WithingsByDate,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const metrics of Object.values(byDate)) {
    for (const [key, entry] of Object.entries(metrics ?? {})) {
      out[key] = entry?.value ?? null;
    }
  }
  return out;
}

export function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const SLEEP_STAGES = [
  { id: "deep", key: "sleep_deep_min" },
  { id: "rem", key: "sleep_rem_min" },
  { id: "light", key: "sleep_light_min" },
  { id: "awake", key: "sleep_wake_min" },
] as const;

export interface SleepStage {
  id: (typeof SLEEP_STAGES)[number]["id"];
  minutes: number;
  pct: number;
}

/** The night's stages with their share of the total */
export function sleepStages(data: DayMetrics): {
  total: number;
  stages: SleepStage[];
} {
  const minutes = SLEEP_STAGES.map((s) => numberOf(data[s.key]) ?? 0);
  const total = minutes.reduce((a, b) => a + b, 0);
  return {
    total,
    stages: SLEEP_STAGES.map((s, i) => ({
      id: s.id,
      minutes: minutes[i],
      pct: total > 0 ? (minutes[i] / total) * 100 : 0,
    })),
  };
}

export interface Night {
  sleep_duration_min: number | null;
  sleep_start_min: number | null;
  sleep_end_min: number | null;
}

/** Per-day sleep from Garmin, else the fitbit family, over `days` */
export function mergeNights(
  days: readonly string[],
  garmin: WellnessByDate,
  fitbit: WellnessByDate,
): Night[] {
  return days.map((d) => {
    const g = garmin[d] ?? {};
    const f = fitbit[d] ?? {};
    return {
      sleep_duration_min: g.sleep_duration_min ?? f.sleep_duration_min ?? null,
      sleep_start_min: g.sleep_start_min ?? f.sleep_start_min ?? null,
      sleep_end_min: g.sleep_end_min ?? f.sleep_end_min ?? null,
    };
  });
}

/** The days the sleep insights look at: 45 back (30-day debt + chronotype) */
export function sleepInsightDays(
  range: number,
  today = localDateStr(),
): string[] {
  const lookback = Math.max(range, 45);
  return daysBetween(addDays(today, -lookback + 1), today);
}

export interface SleepDebt {
  debtMin: number;
  nights: number;
  goalMin: number;
}

/**
 * Minutes short of the sleep goal over the last `range` nights. The goal
 * is `goals.sleep_duration_min` max ?? min ?? 8 h.
 */
export function sleepDebt(
  nights: readonly Night[],
  range: number,
  goal: { min?: number | null; max?: number | null } | undefined,
): SleepDebt | null {
  const goalMin = goal?.max ?? goal?.min ?? 480;
  let total = 0;
  let counted = 0;
  for (const night of nights.slice(-range)) {
    if (night.sleep_duration_min != null) {
      total += Math.max(0, goalMin - night.sleep_duration_min);
      counted++;
    }
  }
  return counted > 0
    ? { debtMin: Math.round(total), nights: counted, goalMin }
    : null;
}

/** Severity of a sleep debt: none, under 2 h, more */
export function sleepDebtLevel(debtMin: number): "good" | "warn" | "bad" {
  if (debtMin === 0) return "good";
  return debtMin < 120 ? "warn" : "bad";
}

/** Middle of a night in minutes after midnight; nights may cross midnight */
export function sleepMidpoint(
  startMin: number | null,
  endMin: number | null,
): number | null {
  if (startMin == null || endMin == null) return null;
  const end = endMin < startMin ? endMin + 1440 : endMin;
  const mid = (startMin + end) / 2;
  return mid >= 1440 ? mid - 1440 : mid;
}

export type ChronotypeId =
  "earlyBird" | "morning" | "intermediate" | "evening" | "nightOwl";

export function classifyChronotype(avgMidpointMin: number): ChronotypeId {
  const h = avgMidpointMin / 60;
  if (h < 2.0) return "earlyBird";
  if (h < 3.5) return "morning";
  if (h < 5.0) return "intermediate";
  if (h < 6.5) return "evening";
  return "nightOwl";
}

export type Chronotype =
  | { type: ChronotypeId; midpointMin: number; nights: number }
  | { type: null; nights: number; needed: number };

/** Chronotype from the average sleep midpoint; needs 5 nights */
export function chronotype(nights: readonly Night[]): Chronotype | null {
  const midpoints = nights
    .map((n) => sleepMidpoint(n.sleep_start_min, n.sleep_end_min))
    .filter((v): v is number => v != null);
  if (midpoints.length >= 5) {
    const avg = midpoints.reduce((a, b) => a + b, 0) / midpoints.length;
    return {
      type: classifyChronotype(avg),
      midpointMin: Math.round(avg),
      nights: midpoints.length,
    };
  }
  return midpoints.length > 0
    ? { type: null, nights: midpoints.length, needed: 5 }
    : null;
}

/** Minutes after midnight as a clock time in the user's `timeFormat` */
export function formatClock(min: number | null, timeFormat: string): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60) % 24;
  const m = String(Math.round(min % 60)).padStart(2, "0");
  if (timeFormat === "24h") return `${String(h).padStart(2, "0")}:${m}`;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

export type ReadinessBand = "optimal" | "good" | "fair" | "low" | "poor";
export type ScoreTone = "good" | "warn" | "bad";

export function readinessBand(score: number): ReadinessBand {
  if (score >= 80) return "optimal";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  if (score >= 35) return "low";
  return "poor";
}

/** The colour step of a score or sub-score: ≥ 65, ≥ 50, below */
export function scoreTone(score: number): ScoreTone {
  if (score >= 65) return "good";
  return score >= 50 ? "warn" : "bad";
}

export interface ReadinessDay {
  hrv_daily_rmssd: number | null;
  resting_hr: number | null;
  calories_out: number | null;
}

export interface Readiness {
  isCalibrating: false;
  score: number;
  band: ReadinessBand;
  hrv_score: number;
  rhr_score: number;
  sleep_score_used: number;
  activity_penalty: number;
  interaction_penalty: number;
  hrv_baseline: number;
  rhr_baseline: number | null;
  hrv_today: number;
  rhr_today: number | null;
  data_days: number;
  /** The score is the one the server locked in */
  isStored?: boolean;
}

export interface ReadinessCalibrating {
  isCalibrating: true;
  data_days: number;
  needed: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Daily readiness (Wellness.svelte _calcReadiness; in lockstep with
 * server/lib/wellness-scores.js): HRV vs its 30-day baseline (75 %), RHR
 * (5 %), last night's sleep score (12 %), minus activity and HRV × RHR
 * penalties. `history` excludes today, oldest first.
 */
export function calcReadiness(
  todayHrv: number | null,
  todayRhr: number | null,
  todaySleepScore: number | null,
  todayCalories: number | null,
  history: readonly ReadinessDay[],
): Readiness | ReadinessCalibrating | null {
  if (todayHrv == null) return null;
  const histHrv = history
    .map((d) => d.hrv_daily_rmssd)
    .filter((v): v is number => v != null);
  const totalHrvCount = histHrv.length + 1;
  if (totalHrvCount < 3 || histHrv.length < 2) {
    return { isCalibrating: true, data_days: histHrv.length, needed: 3 };
  }
  const hrvBaseline = mean(histHrv);
  const rhrValues = [
    ...history.map((d) => d.resting_hr).filter((v): v is number => v != null),
    ...(todayRhr != null ? [todayRhr] : []),
  ];
  const rhrBaseline = rhrValues.length >= 3 ? mean(rhrValues) : null;

  const hrvRatio = todayHrv / hrvBaseline;
  const hrvScore = clamp(
    hrvRatio >= 1.0
      ? 65 + Math.pow(hrvRatio - 1.0, 0.7) * 80
      : 65 - Math.sqrt(1.0 - hrvRatio) * 55,
    0,
    100,
  );

  let rhrScore = 59;
  if (rhrBaseline != null && todayRhr != null) {
    rhrScore = clamp(59 + (rhrBaseline / todayRhr - 1.0) * 110, 0, 100);
  }

  let interactionPenalty = 0;
  if (
    hrvRatio < 1.0 &&
    rhrBaseline != null &&
    todayRhr != null &&
    todayRhr > rhrBaseline
  ) {
    interactionPenalty = clamp(
      (1.0 - hrvRatio) * (todayRhr - rhrBaseline) * 35,
      0,
      15,
    );
  }

  const sleepBase = todaySleepScore ?? 75;
  const sleepCap = todaySleepScore != null && todaySleepScore < 50 ? 65 : 100;

  const cal7 = history
    .slice(-7)
    .map((d) => d.calories_out)
    .filter((v): v is number => v != null);
  let activityPenalty = 0;
  if (cal7.length >= 3 && todayCalories != null) {
    const calMean = mean(cal7);
    const spike = todayCalories / calMean;
    if (spike > 1.25) activityPenalty += (spike - 1.25) * 40;
    const daysAbove = history
      .slice(-3)
      .filter(
        (d) => d.calories_out != null && d.calories_out > calMean * 1.1,
      ).length;
    activityPenalty += daysAbove * 3;
    activityPenalty = clamp(activityPenalty, 0, 20);
  }

  let score =
    0.75 * hrvScore +
    0.05 * rhrScore +
    0.12 * sleepBase +
    4 -
    activityPenalty -
    interactionPenalty;
  score = Math.min(clamp(Math.round(score), 1, 100), sleepCap);

  return {
    isCalibrating: false,
    score,
    band: readinessBand(score),
    hrv_score: Math.round(hrvScore),
    rhr_score: Math.round(rhrScore),
    sleep_score_used: Math.round(sleepBase),
    activity_penalty: Math.round(activityPenalty),
    interaction_penalty: Math.round(interactionPenalty),
    hrv_baseline: Math.round(hrvBaseline * 10) / 10,
    rhr_baseline: rhrBaseline != null ? Math.round(rhrBaseline) : null,
    hrv_today: Math.round(todayHrv * 10) / 10,
    rhr_today: todayRhr != null ? Math.round(todayRhr) : null,
    data_days: totalHrvCount,
  };
}

/**
 * Readiness for today as the page shows it: history = the 30 days before
 * today, yesterday's calories for the activity penalty (today's still
 * accumulate), a server-stored score winning over the live one.
 */
export function readinessForToday(
  today: DayMetrics,
  days: readonly string[],
  garmin: WellnessByDate,
  fitbit: WellnessByDate,
): Readiness | ReadinessCalibrating | null {
  const history: ReadinessDay[] = days.slice(0, -1).map((d) => {
    const g = garmin[d] ?? {};
    const f = fitbit[d] ?? {};
    return {
      hrv_daily_rmssd: g.hrv_daily_rmssd ?? f.hrv_daily_rmssd ?? null,
      resting_hr: g.resting_hr ?? f.resting_hr ?? null,
      calories_out: g.calories_out ?? f.calories_out ?? null,
    };
  });
  const yesterdayCalories = history.at(-1)?.calories_out ?? null;
  const live = calcReadiness(
    numberOf(today.hrv_daily_rmssd),
    numberOf(today.resting_hr),
    numberOf(today.sleep_score),
    yesterdayCalories,
    history,
  );
  const stored = numberOf(today.readiness_score);
  if (stored != null && live && !live.isCalibrating) {
    const score = Math.round(stored);
    return { ...live, score, band: readinessBand(score), isStored: true };
  }
  return live;
}

export type ReadinessLead = "wellRecovered" | "solid" | "moderate" | "low";
export type ReadinessDriver =
  | { kind: "penalty"; penalty: number }
  | { kind: "hrvLow" | "hrvBelow"; today: number; baseline: number }
  | { kind: "rhrHigh" | "rhrUp"; today: number | null; baseline: number | null }
  | { kind: "sleepLow" | "sleepWeak"; score: number }
  | { kind: "allStrong" | "allHealthy" | "cumulative" };

/** The insight text under the score: a lead by band, then the main driver */
export function readinessInsight(r: Readiness): {
  lead: ReadinessLead;
  driver: ReadinessDriver;
} {
  const lead: ReadinessLead =
    r.score >= 80
      ? "wellRecovered"
      : r.score >= 65
        ? "solid"
        : r.score >= 50
          ? "moderate"
          : "low";
  const penalty = (r.activity_penalty || 0) + (r.interaction_penalty || 0);
  const subs = [
    { key: "hrv", val: r.hrv_score },
    { key: "rhr", val: r.rhr_score },
    { key: "sleep", val: r.sleep_score_used },
  ] as const;
  const lowest = subs.reduce((m, c) => (c.val < m.val ? c : m));

  let driver: ReadinessDriver;
  if (penalty >= 8) {
    driver = { kind: "penalty", penalty };
  } else if (lowest.val < 65) {
    const isSevere = lowest.val < 50;
    if (lowest.key === "hrv") {
      driver = {
        kind: isSevere ? "hrvLow" : "hrvBelow",
        today: r.hrv_today,
        baseline: r.hrv_baseline,
      };
    } else if (lowest.key === "rhr") {
      driver = {
        kind: isSevere ? "rhrHigh" : "rhrUp",
        today: r.rhr_today,
        baseline: r.rhr_baseline,
      };
    } else {
      driver = {
        kind: isSevere ? "sleepLow" : "sleepWeak",
        score: r.sleep_score_used,
      };
    }
  } else if (r.score >= 80) {
    driver = { kind: "allStrong" };
  } else if (r.score >= 65) {
    driver = { kind: "allHealthy" };
  } else {
    driver = { kind: "cumulative" };
  }
  return { lead, driver };
}

export type ResilienceCategory = "optimal" | "balanced" | "low";

/** The server's resilience_category (3 / 2 / 1) */
export function resilienceCategory(value: unknown): ResilienceCategory | null {
  if (value === 3) return "optimal";
  if (value === 2) return "balanced";
  if (value === 1) return "low";
  return null;
}

/** The last 7 days of every wellness metric, oldest first */
export function sparklineSeries(
  days: readonly string[],
  garmin: WellnessByDate,
  fitbit: WellnessByDate,
): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const m of WELLNESS_METRICS) {
    out[m.id] = days.map((d) => garmin[d]?.[m.id] ?? fitbit[d]?.[m.id] ?? null);
  }
  return out;
}

export interface WeekActivity {
  stepsTotal: number;
  stepsAvg: number;
  daysOver10k: number;
  activeMinutes: number;
  caloriesOut: number;
  hasData: boolean;
}

/** The "This week" card from the 7-day series */
export function weekActivity(
  series: Partial<Record<string, (number | null)[]>>,
): WeekActivity {
  const steps = series.steps ?? [];
  const active = series.active_minutes ?? [];
  const calories = series.calories_out ?? [];
  const sum = (list: (number | null)[]) =>
    list.reduce<number>((a, v) => a + (Number(v) || 0), 0);
  const stepsTotal = sum(steps);
  const stepDays = steps.filter((v) => v != null).length;
  return {
    stepsTotal,
    stepsAvg: stepDays ? Math.round(stepsTotal / stepDays) : 0,
    daysOver10k: steps.filter((v) => (Number(v) || 0) >= 10000).length,
    activeMinutes: Math.round(sum(active)),
    caloriesOut: Math.round(sum(calories)),
    hasData: steps.some((v) => v != null) || active.some((v) => v != null),
  };
}

/**
 * Metrics that crossed their minimum goal since the last check (goal
 * celebration): `previous` null means the first load.
 */
export function crossedGoals(
  previous: DayMetrics | null,
  current: DayMetrics,
  goals: Record<string, { min?: number | null } | undefined>,
): string[] {
  const crossed: string[] = [];
  for (const [id, goal] of Object.entries(goals)) {
    const target = goal?.min;
    if (!target) continue;
    const before = numberOf(previous?.[id]);
    const now = numberOf(current[id]);
    if (now != null && now >= target && (before == null || before < target)) {
      crossed.push(id);
    }
  }
  return crossed;
}

export type WorkoutKind =
  | "run"
  | "walk"
  | "hike"
  | "bike"
  | "swim"
  | "yoga"
  | "strength"
  | "racket"
  | "dance"
  | "other";

/** The icon kind of a workout from its name (_workoutIcon) */
export function workoutKind(name: string | null | undefined): WorkoutKind {
  const n = (name ?? "").toLowerCase();
  if (n.includes("run")) return "run";
  if (n.includes("walk")) return "walk";
  if (n.includes("hike")) return "hike";
  if (n.includes("bike") || n.includes("cycl")) return "bike";
  if (n.includes("swim")) return "swim";
  if (n.includes("yoga")) return "yoga";
  if (
    n.includes("weight") ||
    n.includes("strength") ||
    n.includes("elliptical") ||
    n.includes("cross")
  ) {
    return "strength";
  }
  if (
    n.includes("tennis") ||
    n.includes("basketball") ||
    n.includes("soccer")
  ) {
    return "racket";
  }
  if (n.includes("dance")) return "dance";
  return "other";
}

/** Milliseconds as "1:02:03" or "2:03" */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "0:00";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type HeartRateZone = "easy" | "moderate" | "hard" | "peak";

/** The GPS route's colour zones (<130, 130–150, 150–170, >170 bpm) */
export function heartRateZone(hr: number): HeartRateZone {
  if (hr > 170) return "peak";
  if (hr > 150) return "hard";
  if (hr > 130) return "moderate";
  return "easy";
}

/** The `from` of a sync over `range` days ending on `day` */
export function syncFrom(day: string, range: number): string {
  return range > 1 ? addDays(day, -(range - 1)) : day;
}

/** Auto-sync waits this long per day between runs */
export const AUTO_SYNC_COOLDOWN_MS = 15 * 60 * 1000;

/** The visible tabs for the integrations that are on */
export function visibleTabs(enabled: {
  hasActivity: boolean;
  hasBody: boolean;
}): WellnessTab[] {
  return [
    ...(enabled.hasActivity ? (["activity", "sleep", "heart"] as const) : []),
    ...(enabled.hasBody ? (["body"] as const) : []),
  ];
}
