/**
 * When the setup assistant opens by itself, and what its unit choice sets.
 * The old trigger (`/auth/status.setup_required`) never fires with SSO:
 * Trace remembers `setupComplete` as a row of NutriTrace's settings.
 */
export const SETUP_COMPLETE_KEY = "setupComplete";

export interface SetupState {
  setupComplete?: unknown;
  goals?: unknown;
}

/** A fresh account: never finished (or skipped) the setup, and no goals */
export function needsSetup(values: SetupState): boolean {
  if (values.setupComplete === true) return false;
  const goals = values.goals as Record<string, unknown> | null | undefined;
  return !goals || Object.keys(goals).length === 0;
}

export type UnitSystem = "metric" | "imperial";

export function energyUnitFor(locale: string): "kcal" | "kJ" {
  return /^en-(au|nz)\b/i.test(locale) ? "kJ" : "kcal";
}

export function unitsFor(system: UnitSystem, locale: string) {
  const isMetric = system === "metric";
  return {
    weightUnit: isMetric ? "kg" : "lb",
    liftWeightUnit: isMetric ? "kg" : "lbs",
    heightUnit: isMetric ? "cm" : "ft",
    lengthUnit: isMetric ? "cm" : "in",
    distUnit: isMetric ? "km" : "mi",
    tempUnit: isMetric ? "C" : "F",
    waterUnit: isMetric ? "ml" : "oz",
    energyUnit: energyUnitFor(locale),
    measurementSystem: system,
  };
}

type Values = Record<string, unknown>;

/**
 * The body data the setup works with: NutriTrace's, and where it has none,
 * LiftTrace's (an account may have entered it in one app only).
 */
export function setupBody(nt: Values, lt: Values) {
  const number = (...values: unknown[]) =>
    values.map(Number).find((value) => value > 0) ?? 0;
  const text = (...values: unknown[]) =>
    values.find(
      (value): value is string => typeof value === "string" && value !== "",
    ) ?? "";
  return {
    gender: text(nt.gender, lt.gender),
    birthday: text(nt.dob, lt.dob),
    heightCm: number(nt.height_cm, lt.heightCm),
    weightKg: number(nt.weight_kg, lt.currentWeightKg),
    targetKg: number(nt.target_weight),
    activity: text(nt.activity),
  };
}

/** What `PUT /lt/api/auth/profile` takes of it; null when there is nothing */
export function liftProfile(body: {
  gender: string;
  birthday: string;
}): { gender?: string; birthday?: string } | null {
  const profile = {
    ...(body.gender ? { gender: body.gender } : {}),
    ...(body.birthday ? { birthday: body.birthday } : {}),
  };
  return Object.keys(profile).length ? profile : null;
}
