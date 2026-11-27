/**
 * Can a product's values be used (#241)? Ported from
 * nutritrace/src/lib/off-nutrition.js. The mapper turns missing values into
 * 0, so a product with no "as sold" values would pass for a 0 kcal food.
 * "As prepared" values are never used unasked: what they describe varies.
 */
import type { OffInfo } from "./types";

/** Pure fat is 900 kcal per 100 g; above it is a typo (kJ typed as kcal) */
export const MAX_KCAL_PER_100 = 900;

export type OffNutritionStatus = "ok" | "preparedOnly" | "implausible" | "none";

export interface OffStatusSubject {
  /** A number means a saved food, which is never flagged */
  id?: unknown;
  barcode?: string | null;
  nutrition?: object | null;
  offInfo?: OffInfo | null;
}

function ownCalories(food: OffStatusSubject): number {
  return Number((food.nutrition as { calories?: unknown } | null)?.calories);
}

export function offNutritionStatus(
  food: OffStatusSubject | null | undefined,
  info: OffInfo | null | undefined = food?.offInfo,
): OffNutritionStatus {
  if (!food || typeof food.id === "number" || !food.barcode || !info) {
    return "ok";
  }
  // A food with calories of its own is real, whatever OFF says of the barcode
  const kcal = ownCalories(food);
  if (Number.isFinite(kcal) && kcal > 0) return "ok";
  if (info.present.length > 0) return "ok";
  const { prepared } = info;
  if (prepared && prepared.present.length > 0) {
    return (prepared.nutrition.calories ?? 0) > MAX_KCAL_PER_100
      ? "implausible"
      : "preparedOnly";
  }
  return "none";
}

/** Search hits leave out "as prepared" values; a full lookup may add some */
export function needsFullLookup(info: OffInfo | null | undefined): boolean {
  return !!info && !info.isFull && info.present.length === 0;
}

/** A result row that should say "no values listed" instead of 0 kcal */
export function hasNoOffValues(food: OffStatusSubject): boolean {
  if (
    food.offInfo &&
    food.offInfo.present.length === 0 &&
    !(ownCalories(food) > 0)
  ) {
    return true;
  }
  return offNutritionStatus(food) !== "ok";
}

export interface OffNotice {
  status: Exclude<OffNutritionStatus, "ok">;
  /** The "as prepared" calories, rounded; null without them */
  kcal: number | null;
  unit: string;
  info: OffInfo;
}

/** What the editor says under the barcode; null when there is nothing to say */
export function offNotice(
  barcode: string,
  info: OffInfo | null | undefined,
): OffNotice | null {
  const status = offNutritionStatus({ barcode }, info);
  if (status === "ok" || !info) return null;
  const { prepared } = info;
  return {
    status,
    kcal: prepared ? Math.round(prepared.nutrition.calories ?? 0) : null,
    unit: prepared?.unit ?? "g",
    info,
  };
}
