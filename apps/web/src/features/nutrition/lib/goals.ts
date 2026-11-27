/**
 * The Goals screen's logic, ported from nutritrace/src/routes/Goals.svelte.
 * Targets are stored by stat id in the `goals` setting; energy always in
 * kcal under `calories` (the kilojoules row is only a display of it, #146).
 */

import type { Goals } from "../api";
import { BODY_STAT_KEYS, LENGTH_KEYS } from "./bodyStats";
import { parseDecimal, toInputValue } from "./decimal";
import {
  gramsGoalToPercent,
  macroGoalGrams,
  percentGoalToGrams,
  resolveGoalFor,
  type GoalEntry,
} from "./goalResolver";
import {
  KJ_PER_KCAL,
  MACRO_DENSITY,
  NUTRIMENTS,
  type EnergyUnit,
} from "./nutrition";

export const GOAL_BODY_STATS = BODY_STAT_KEYS;

export const WELLNESS_GOALS = [
  { id: "steps", unit: "steps" },
  { id: "active_minutes", unit: "min" },
  { id: "floors", unit: "floors" },
  { id: "calories_out", unit: "kcal" },
  { id: "sleep_duration_min", unit: "min" },
  { id: "sleep_efficiency", unit: "%" },
  { id: "hrv_daily_rmssd", unit: "ms" },
  { id: "weight_kg", unit: "kg" },
  { id: "body_fat_pct", unit: "%" },
  { id: "muscle_mass_kg", unit: "kg" },
] as const;

export type WellnessGoalId = (typeof WELLNESS_GOALS)[number]["id"];

export function isWellnessGoal(id: string): id is WellnessGoalId {
  return WELLNESS_GOALS.some((goal) => goal.id === id);
}

export function isBodyStatGoal(id: string): boolean {
  return (GOAL_BODY_STATS as readonly string[]).includes(id);
}

export function bodyStatUnit(
  id: string,
  weightUnit: string,
  lengthUnit: string,
): string {
  if (id === "weight") return weightUnit || "kg";
  return (LENGTH_KEYS as readonly string[]).includes(id)
    ? lengthUnit || "in"
    : "%";
}

/** The nutrient rows: one energy row, in the user's unit */
export function nutrientGoalIds(energyUnit: EnergyUnit): string[] {
  const hidden = energyUnit === "kJ" ? "calories" : "kilojoules";
  return NUTRIMENTS.filter((nutrient) => nutrient.id !== hidden).map(
    (nutrient) => nutrient.id,
  );
}

/** Where a row's goal is stored */
export function goalStorageId(statId: string): string {
  return statId === "kilojoules" ? "calories" : statId;
}

/** Whether the row shows and takes kJ for a value stored in kcal */
export function isShownInKj(statId: string, energyUnit: EnergyUnit): boolean {
  return (
    statId === "kilojoules" ||
    (statId === "calories_out" && energyUnit === "kJ")
  );
}

/** An old `kilojoules` goal becomes a `calories` goal in kcal (#146) */
export function migrateKilojoulesGoal(goals: Goals): Goals {
  if (!goals.kilojoules) return goals;
  const next: Goals = { ...goals };
  const kj = next.kilojoules;
  delete next.kilojoules;
  if (next.calories || !kj) return next;
  const hasDays = Boolean(
    kj.days?.some(
      (value) => value != null && Number.isFinite(value) && value > 0,
    ),
  );
  const shared = kj.max ?? kj.min;
  if (!hasDays && !(shared != null && shared > 0)) return next;
  const entry: GoalEntry = { ...kj };
  delete entry.max;
  delete entry.min;
  delete entry.days;
  if (kj.max != null) entry.max = kj.max / KJ_PER_KCAL;
  if (kj.min != null) entry.min = kj.min / KJ_PER_KCAL;
  if (kj.days) {
    entry.days = kj.days.map((value) =>
      value != null ? value / KJ_PER_KCAL : null,
    );
  }
  next.calories = entry;
  return next;
}

// ── The editor ──────────────────────────────────────────────────────────

export interface GoalForm {
  isShared: boolean;
  isMin: boolean;
  isPercent: boolean;
  isAutoAdjust: boolean;
  isShownInDiary: boolean;
  isShownInStats: boolean;
  /** The shared target as typed */
  value: string;
  /** Sunday first */
  days: string[];
}

/** The editor as a goal opens in it; every field starts from this goal */
export function goalFormOf(
  entry: GoalEntry | undefined,
  statId: string,
  energyUnit: EnergyUnit,
): GoalForm {
  const isKj = isShownInKj(statId, energyUnit);
  const text = (value: number | null | undefined) => {
    if (value == null) return "";
    return isKj ? String(Math.round(value * KJ_PER_KCAL)) : toInputValue(value);
  };
  const isShared = entry?.sharedGoal !== false;
  const shared = entry ? (entry.max ?? entry.min) : null;
  return {
    isShared,
    isMin: Boolean(entry?.isMin),
    isPercent: Boolean(entry?.isPercent),
    isAutoAdjust: Boolean(entry?.autoAdjust),
    isShownInDiary: entry?.showInDiary !== false,
    isShownInStats: entry?.showInStats !== false,
    value: text(shared),
    days: Array.from({ length: 7 }, (_, index) =>
      text(isShared ? shared : entry.days?.[index]),
    ),
  };
}

/** An empty field is "not set"; 0 is a target (upstream dropped it) */
function targetOf(text: string, isKj: boolean): number | null {
  const number = parseDecimal(text);
  if (!Number.isFinite(number) || number < 0) return null;
  return isKj ? number / KJ_PER_KCAL : number;
}

/**
 * The stored entry. A per-weekday goal keeps its weekly peak in `max` or
 * `min` for old readers; `days` is what counts.
 */
export function goalEntryOf(
  form: GoalForm,
  statId: string,
  energyUnit: EnergyUnit,
): GoalEntry {
  const isKj = isShownInKj(statId, energyUnit);
  const shared = targetOf(form.value, isKj);
  const days = form.isShared
    ? Array<number | null>(7).fill(shared)
    : form.days.map((value) => targetOf(value, isKj));
  const valid = days.filter((value): value is number => value != null);
  const peak = valid.length > 0 ? Math.max(...valid) : null;
  const target = form.isShared ? shared : peak;
  return {
    sharedGoal: form.isShared,
    isMin: form.isMin,
    isPercent: form.isPercent,
    autoAdjust: form.isAutoAdjust,
    showInDiary: form.isShownInDiary,
    showInStats: form.isShownInStats,
    days,
    ...(form.isMin ? { min: target } : { max: target }),
  };
}

export function saveGoal(
  goals: Goals,
  statId: string,
  entry: GoalEntry,
): Goals {
  const next: Goals = { ...goals, [goalStorageId(statId)]: entry };
  delete next.kilojoules;
  return next;
}

export function removeGoal(goals: Goals, statId: string): Goals {
  const gone = new Set([goalStorageId(statId), statId]);
  return Object.fromEntries(
    Object.entries(goals).filter(([id]) => !gone.has(id)),
  );
}

/** "As percent" switched: the typed values keep their meaning */
export function togglePercent(
  form: GoalForm,
  isPercent: boolean,
  statId: string,
  calGoalKcal: number,
): GoalForm {
  const density = MACRO_DENSITY[statId];
  if (!density) return { ...form, isPercent };
  const convert = (text: string) => {
    const number = parseDecimal(text);
    if (!Number.isFinite(number)) return text;
    const result = isPercent
      ? gramsGoalToPercent(number, calGoalKcal, density)
      : percentGoalToGrams(number, calGoalKcal, density);
    return result == null ? text : String(result);
  };
  return {
    ...form,
    isPercent,
    value: convert(form.value),
    days: form.days.map(convert),
  };
}

// ── Showing targets ─────────────────────────────────────────────────────

/**
 * A row's target on `date`, in the unit the row shows. Percent macros are
 * grams of the day's calorie goal, the one basis of every screen.
 */
export function rowTarget(
  goals: Goals,
  statId: string,
  date: string,
  calGoalKcal: number,
  energyUnit: EnergyUnit,
): number | null {
  const entry = goals[goalStorageId(statId)];
  if (!entry) return null;
  const raw = resolveGoalFor(entry, date);
  if (raw == null) return null;
  if (isShownInKj(statId, energyUnit)) return Math.round(raw * KJ_PER_KCAL);
  return macroGoalGrams(
    { max: raw, isPercent: entry.isPercent },
    calGoalKcal,
    MACRO_DENSITY[statId],
  );
}

/** Past a maximum, or short of a minimum */
export function isMissed(
  current: number | null,
  target: number | null,
  isMin: boolean,
): boolean {
  if (current === null || target === null) return false;
  return isMin ? current < target : current > target;
}

// ── Macros ──────────────────────────────────────────────────────────────

export interface MacroTargets {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export function macroTargets(
  goals: Goals,
  date: string,
  calGoalKcal: number,
): MacroTargets {
  const grams = (id: string) => rowTarget(goals, id, date, calGoalKcal, "kcal");
  return {
    protein: grams("proteins"),
    carbs: grams("carbohydrates"),
    fat: grams("fat"),
  };
}

export function macroKcal(targets: MacroTargets): number {
  return (
    (targets.protein ?? 0) * 4 +
    (targets.carbs ?? 0) * 4 +
    (targets.fat ?? 0) * 9
  );
}

/** Each macro's share of the macro calories, rounded on its own */
export function macroShares(targets: MacroTargets): {
  protein: number;
  carbs: number;
  fat: number;
} {
  const total = macroKcal(targets);
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  const share = (grams: number | null, density: number) =>
    Math.round((((grams ?? 0) * density) / total) * 100);
  return {
    protein: share(targets.protein, 4),
    carbs: share(targets.carbs, 4),
    fat: share(targets.fat, 9),
  };
}

export const MACRO_PRESETS = {
  balanced: { protein: 30, carbs: 40, fat: 30 },
  keto: { protein: 25, carbs: 5, fat: 70 },
  highProtein: { protein: 40, carbs: 30, fat: 30 },
} as const;

export type MacroPreset = keyof typeof MACRO_PRESETS;
export const MACRO_PRESET_IDS = Object.keys(MACRO_PRESETS) as MacroPreset[];

/** The preset the shares match within 2 points; null without any macro */
export function currentPreset(shares: {
  protein: number;
  carbs: number;
  fat: number;
}): MacroPreset | "custom" | null {
  if (!shares.protein && !shares.carbs && !shares.fat) return null;
  const match = MACRO_PRESET_IDS.find((id) => {
    const preset = MACRO_PRESETS[id];
    return (
      Math.abs(shares.protein - preset.protein) <= 2 &&
      Math.abs(shares.carbs - preset.carbs) <= 2 &&
      Math.abs(shares.fat - preset.fat) <= 2
    );
  });
  return match ?? "custom";
}

/** The preset's grams for `kcal`, keeping each goal's display switches */
export function applyMacroPreset(
  goals: Goals,
  preset: MacroPreset,
  kcal: number,
): Goals {
  const ratio = MACRO_PRESETS[preset];
  const entry = (id: string, percent: number, density: number): GoalEntry => {
    const grams = Math.round((kcal * percent) / 100 / density);
    const next: GoalEntry = {
      sharedGoal: true,
      showInDiary: true,
      showInStats: true,
      ...goals[id],
      isMin: false,
      isPercent: false,
      max: grams,
      days: Array<number>(7).fill(grams),
    };
    // A preset is one maximum for every day
    next.sharedGoal = true;
    delete next.min;
    return next;
  };
  return {
    ...goals,
    proteins: entry("proteins", ratio.protein, 4),
    carbohydrates: entry("carbohydrates", ratio.carbs, 4),
    fat: entry("fat", ratio.fat, 9),
  };
}

export type GoalWarning =
  | { kind: "tooLow" | "tooHigh" }
  | { kind: "mismatch"; macroKcal: number }
  | { kind: "noMacros" };

/** The preview's non-blocking notes */
export function goalWarnings(
  calGoalKcal: number,
  macroSumKcal: number,
): GoalWarning[] {
  const warnings: GoalWarning[] = [];
  if (calGoalKcal && calGoalKcal < 1200) warnings.push({ kind: "tooLow" });
  else if (calGoalKcal > 5000) warnings.push({ kind: "tooHigh" });
  if (
    macroSumKcal > 0 &&
    calGoalKcal > 0 &&
    Math.abs(macroSumKcal - calGoalKcal) > calGoalKcal * 0.05
  ) {
    warnings.push({ kind: "mismatch", macroKcal: Math.round(macroSumKcal) });
  }
  if (macroSumKcal <= 0) warnings.push({ kind: "noMacros" });
  return warnings;
}

/** How many targets a template holds, the water goal included */
export function templateGoalCount(goals: Goals, waterGoalMl: number): number {
  return (
    Object.values(goals).filter(
      (entry) => entry?.min != null || entry?.max != null,
    ).length + (waterGoalMl > 0 ? 1 : 0)
  );
}
