/**
 * Body stats in the unit they were written in, ported from
 * nutritrace/src/lib/body-stats-unit.js. A reading carries `weight_unit` /
 * `lengths_unit`; untagged legacy readings count as the display unit.
 */
import type { BodyStats } from "../api";

export const LENGTH_KEYS = [
  "neck",
  "waist",
  "hips",
  "chest",
  "thighs",
  "biceps",
  "calves",
] as const;

/** Every body stat, in the old UI's order */
export const BODY_STAT_KEYS = [
  "weight",
  "body_fat",
  "body_water",
  ...LENGTH_KEYS,
] as const;

export type BodyStatKey = (typeof BODY_STAT_KEYS)[number];

const KG_PER_LB = 1 / 2.20462;
const CM_PER_IN = 2.54;

function convertWeight(value: number, from: string, to: string): number {
  if (from === to) return value;
  if (from === "lb" && to === "kg")
    return Math.round(value * KG_PER_LB * 10) / 10;
  if (from === "kg" && to === "lb")
    return Math.round(value * 2.20462 * 10) / 10;
  return value;
}

function convertLength(value: number, from: string, to: string): number {
  if (from === to) return value;
  if (from === "in" && to === "cm")
    return Math.round(value * CM_PER_IN * 10) / 10;
  if (from === "cm" && to === "in")
    return Math.round((value / CM_PER_IN) * 10) / 10;
  return value;
}

function isLengthKey(key: string): boolean {
  return (LENGTH_KEYS as readonly string[]).includes(key);
}

/** `stats[metric]` in the display units, or null */
export function readBodyStat(
  stats: BodyStats | null | undefined,
  metric: string,
  weightUnit: string,
  lengthUnit: string,
): number | null {
  if (!stats) return null;
  const raw = (stats as Record<string, unknown>)[metric];
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (metric === "weight") {
    const stored = stats.weight_unit || weightUnit || "kg";
    return convertWeight(value, stored, weightUnit || "kg");
  }
  if (isLengthKey(metric)) {
    const stored = stats.lengths_unit || lengthUnit || "in";
    return convertLength(value, stored, lengthUnit || "in");
  }
  return value;
}

/** Tags the units of the fields being written, so a later unit switch can't reinterpret them */
export function tagBodyStats(
  stats: BodyStats,
  weightUnit: string,
  lengthUnit: string,
): BodyStats {
  const out: BodyStats = { ...stats };
  const hasWeight = out.weight != null && out.weight !== "";
  const hasLength = LENGTH_KEYS.some(
    (key) => out[key] != null && out[key] !== "",
  );
  if (hasWeight) out.weight_unit = (weightUnit || "kg") as "kg" | "lb";
  if (hasLength) out.lengths_unit = (lengthUnit || "in") as "in" | "cm";
  return out;
}

/** A weight in the display unit as kg */
export function weightToKg(value: number, unit: string): number {
  if (unit === "lb") return value * KG_PER_LB;
  if (unit === "st") return value * 6.35029;
  return value;
}
