/**
 * Body data: the unit conversions of the old Profile and Wizard screens and
 * the wizard's energy and water targets (nutritrace/src/lib/nutrition.js
 * calculateTDEE, routes/Wizard.svelte calcSummary).
 */
export const GENDERS = ["male", "female", "non-binary", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const ACTIVITIES = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** NutriTrace's and CookTrace's profile spell them out; LiftTrace doesn't */
const PROFILE_GENDERS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  "non-binary": "Non-binary",
  other: "Prefer not to say",
};

export function profileGender(
  backend: "nt" | "ct" | "lt",
  gender: Gender | "",
): string {
  if (!gender) return "";
  return backend === "lt" ? gender : PROFILE_GENDERS[gender];
}

export function readGender(value: unknown): Gender | "" {
  if (typeof value !== "string") return "";
  const text = value.toLowerCase();
  if (text === "prefer not to say") return "other";
  return GENDERS.find((gender) => gender === text) ?? "";
}

const KG_PER_LB = 0.45359237;
const KG_PER_STONE = 6.35029318;

export function weightToKg(value: number, unit: string): number {
  if (unit === "lb" || unit === "lbs") return value * KG_PER_LB;
  if (unit === "st") return value * KG_PER_STONE;
  return value;
}

export function weightFromKg(kg: number, unit: string): number {
  return kg / weightToKg(1, unit);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / 2.54);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round(feet * 30.48 + inches * 2.54);
}

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const ACTIVITY_WATER: Record<Activity, number> = {
  sedentary: 0,
  light: 350,
  moderate: 500,
  active: 700,
  very_active: 1000,
};

export interface BodyProfile {
  gender: Gender | "";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
}

/** Mifflin-St Jeor times the activity factor */
export function totalEnergyExpenditure(profile: BodyProfile): number {
  const height = profile.heightCm || 170;
  const weight = profile.weightKg || 70;
  const age = Math.trunc(profile.age) || 30;
  const bmr =
    height * 6.25 +
    weight * 9.99 -
    age * 4.92 +
    // The old wizard assumed "male" while no gender was chosen, and used
    // the female constant for every other choice.
    (!profile.gender || profile.gender === "male" ? 5 : -161);
  return Math.round(bmr * ACTIVITY_FACTOR[profile.activity]);
}

export interface Targets {
  tdee: number;
  /** kcal per day: 20% less or more when the target weight is over 1% off */
  calories: number;
  waterMl: number;
}

export function dailyTargets(profile: BodyProfile, targetKg: number): Targets {
  const tdee = totalEnergyExpenditure({
    ...profile,
    age: Math.max(15, profile.age),
  });
  const weight = profile.weightKg || 70;
  const factor =
    targetKg && targetKg < weight * 0.99
      ? 0.8
      : targetKg > weight * 1.01
        ? 1.2
        : 1;
  const water = weight * 35 + ACTIVITY_WATER[profile.activity];
  return {
    tdee,
    calories: Math.round(tdee * factor),
    waterMl: Math.round(water / 50) * 50,
  };
}

export function ageOn(birthday: string, now: Date = new Date()): number {
  const born = new Date(birthday).getTime();
  return Number.isNaN(born)
    ? 0
    : Math.floor((now.getTime() - born) / (365.25 * 86_400_000));
}

/** The wizard's calorie goal, in the shape of the `goals` setting */
export function calorieGoal(kcal: number): Record<string, unknown> {
  return {
    max: kcal,
    sharedGoal: true,
    isMin: false,
    showInDiary: true,
    showInStats: true,
    days: [kcal, kcal, kcal, kcal, kcal, kcal, kcal],
  };
}
