/**
 * The metric lists of the wellness settings, per provider
 * (components/settings/SettingsWellness.svelte).
 */
import { ALL_VISIBILITY_IDS } from "./wellness";

export const FITBIT_VISIBILITY: readonly string[] = [
  "active_minutes",
  "active_zone_minutes",
  "calories_out",
  "sleep_deep_min",
  "distance_km",
  "floors",
  "hrv_daily_rmssd",
  "sleep_light_min",
  "sleep_rem_min",
  "respiratory_rate",
  "resting_hr",
  "sleep_duration_min",
  "sleep_efficiency",
  "skin_temp_variation",
  "sleep_score",
  "spo2_avg",
  "steps",
  "vo2_max",
  "sleep_wake_min",
];

export const GARMIN_VISIBILITY: readonly string[] = [
  "active_minutes",
  "body_battery_high",
  "body_battery_low",
  "calories_out",
  "sleep_deep_min",
  "distance_km",
  "floors",
  "hrv_daily_rmssd",
  "sleep_light_min",
  "max_hr",
  "moderate_intensity_min",
  "sleep_rem_min",
  "respiratory_rate",
  "resting_hr",
  "sleep_duration_min",
  "sleep_score",
  "spo2_avg",
  "steps",
  "stress_avg",
  "vigorous_intensity_min",
  "sleep_wake_min",
];

export const WITHINGS_VISIBILITY: readonly string[] = [
  "ecg_afib",
  "basal_metabolic_rate",
  "body_fat_pct",
  "body_water_pct",
  "bone_mass_kg",
  "eda_feet",
  "ecg_heart_rate",
  "extracellular_water_kg",
  "fat_mass_kg",
  "intracellular_water_kg",
  "lean_mass_kg",
  "metabolic_age",
  "muscle_mass_kg",
  "nerve_health_score",
  "pulse_wave_velocity",
  "segmental_analysis",
  "vascular_age",
  "visceral_fat",
  "visceral_fat_index",
  "weight_kg",
];

export const HEALTH_CONNECT_VISIBILITY: readonly string[] = [
  "active_calories",
  "active_minutes",
  "avg_heart_rate",
  "basal_metabolic_rate",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "body_fat_pct",
  "body_temperature",
  "bone_mass_kg",
  "calories_out",
  "distance_km",
  "floors",
  "lean_mass_kg",
  "resting_hr",
  "respiratory_rate",
  "sleep_duration_min",
  "sleep_deep_min",
  "sleep_light_min",
  "sleep_rem_min",
  "sleep_wake_min",
  "spo2_avg",
  "steps",
  "vo2_max",
  "water_ml",
  "weight_kg",
];

/** Every id a toggle starts from when all metrics are visible */
export const SETTINGS_VISIBILITY_IDS: readonly string[] = [
  ...new Set([
    ...ALL_VISIBILITY_IDS,
    ...FITBIT_VISIBILITY,
    ...GARMIN_VISIBILITY,
    ...WITHINGS_VISIBILITY,
    ...HEALTH_CONNECT_VISIBILITY,
  ]),
];

export type SyncDevice = "fitbit" | "garmin" | "withings" | "healthConnect";

/** The sync intervals in minutes; 1440 is once a day */
export const SYNC_INTERVALS = [30, 60, 120, 180, 360, 720, 1440] as const;

export const SYNC_MODES = ["auto", "manual", "scheduled"] as const;

export const RECOMMENDED_SYNC_RANGES = [1, 7, 30, 90] as const;

/** Longer ranges each provider allows, and the most days a custom one may be */
export const SYNC_RANGE_LIMITS = {
  fitbit: { advanced: [180, 365], max: 365 },
  garmin: { advanced: [180], max: 180 },
  withings: { advanced: [180, 365], max: 365 },
} as const;

/** A typed number of days within 1…max */
export function clampDays(input: string, max: number): number {
  const days = Number.parseInt(input, 10);
  return Math.max(1, Math.min(max, Number.isFinite(days) ? days : 1));
}
