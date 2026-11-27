/**
 * NutriTrace's anonymised calibration export ("Help improve",
 * routes/settings/HelpImprove.svelte): scores and biometrics of the last 30
 * days with day numbers instead of dates and no identity.
 */
import { isoDate } from "./dates";

type Day = Partial<Record<string, unknown>>;
export type WellnessRows = Partial<Record<string, Day>>;

const DAYS = 30;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function calibrationRange(now: Date = new Date()): {
  from: string;
  to: string;
  dates: string[];
} {
  const dates = Array.from({ length: DAYS }, (_, index) =>
    isoDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (DAYS - 1) + index,
      ),
    ),
  );
  return { from: dates[0] ?? "", to: dates[DAYS - 1] ?? "", dates };
}

export function calibrationDays(
  dates: readonly string[],
  fitbit: WellnessRows,
  garmin: WellnessRows,
): Record<string, unknown>[] {
  return dates.flatMap((date, index) => {
    const f = fitbit[date] ?? {};
    const g = garmin[date] ?? {};
    const either = (key: string) => f[key] ?? g[key] ?? null;
    // Our own score only where Fitbit's published one isn't there.
    const calculated = (name: string) =>
      f[`${name}_score_actual`] ? null : (f[`${name}_score`] ?? null);
    const row = {
      dayIndex: index + 1,
      dayOfWeek: DAY_NAMES[new Date(`${date}T12:00:00`).getDay()],
      fitbit_sleep_actual: f.sleep_score_actual ?? null,
      fitbit_readiness_actual: f.readiness_score_actual ?? null,
      fitbit_stress_actual: f.stress_score_actual ?? null,
      sleep_calc: calculated("sleep"),
      readiness_calc: calculated("readiness"),
      stress_calc: calculated("stress"),
      garmin_sleep: g.sleep_score ?? null,
      garmin_stress: g.stress_avg ?? null,
      hrv: either("hrv_daily_rmssd"),
      rhr: either("resting_hr"),
      sleep_min: either("sleep_duration_min"),
      deep_min: either("sleep_deep_min"),
      rem_min: either("sleep_rem_min"),
      efficiency: f.sleep_efficiency ?? null,
      spo2: f.spo2_avg ?? null,
      calories_out: either("calories_out"),
    };
    const hasData = [
      row.fitbit_sleep_actual,
      row.sleep_calc,
      row.garmin_sleep,
      row.hrv,
      row.rhr,
    ].some((value) => value !== null);
    return hasData ? [row] : [];
  });
}
