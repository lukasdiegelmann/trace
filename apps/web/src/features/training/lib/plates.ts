/**
 * The gym tools' math, ported from LiftTrace
 * `src/components/diary/GymTools.svelte`: which plates go on each side of
 * the bar for a target weight, and pounds <-> kilograms.
 */

export type WeightUnit = "kg" | "lbs";
export type ConvertDirection = "lbsToKg" | "kgToLbs";

/** The empty bar: 20 kg or 45 lbs */
export const BAR_WEIGHT: Record<WeightUnit, number> = { kg: 20, lbs: 45 };

/** Available plates per unit, largest first */
export const PLATES: Record<WeightUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

const LBS_PER_KG = 2.20462;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PlateLoad {
  bar: number;
  /** Plates on one side, largest first; empty at or below the bar */
  perSide: number[];
  /** What the available plates can't load (both sides), 2 decimals */
  remainder: number;
}

/** Greedy, largest plate first, as in the old UI */
export function calcPlates(target: string, unit: WeightUnit): PlateLoad {
  const bar = BAR_WEIGHT[unit];
  const total = parseFloat(target) || 0;
  const perSide: number[] = [];
  const remaining = (total - bar) / 2;
  if (remaining > 0) {
    let left = remaining;
    for (const plate of PLATES[unit]) {
      while (left >= plate - 0.001) {
        perSide.push(plate);
        left -= plate;
      }
    }
  }
  const used = perSide.reduce((sum, plate) => sum + plate, 0) * 2 + bar;
  return { bar, perSide, remainder: round2(total - used) };
}

export interface PlateCount {
  plate: number;
  count: number;
}

/** One entry per distinct plate, in the order it first appears */
export function countPlates(perSide: readonly number[]): PlateCount[] {
  const counts = new Map<number, number>();
  for (const plate of perSide) counts.set(plate, (counts.get(plate) ?? 0) + 1);
  return [...counts].map(([plate, count]) => ({ plate, count }));
}

/** Height of a plate in the visual stack, in px */
export function plateHeight(plate: number, unit: WeightUnit): number {
  return Math.max(28, 20 + plate * (unit === "kg" ? 1.2 : 0.5));
}

/** Converts the input in the given direction; invalid input counts as 0 */
export function convertWeight(
  input: string,
  direction: ConvertDirection,
): number {
  const value = parseFloat(input) || 0;
  return direction === "lbsToKg"
    ? round2(value / LBS_PER_KG)
    : round2(value * LBS_PER_KG);
}
