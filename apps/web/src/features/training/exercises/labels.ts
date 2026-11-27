/**
 * The app's names for the values LiftTrace stores in English (categories,
 * the built-in equipment and muscles). Anything else is the user's or a
 * catalog's own word and is shown as it is.
 */
import type { TFunction } from "i18next";
import type { ParseKeys } from "i18next";

import { EQUIPMENT_BUCKETS } from "../lib/equipment";
import { CATEGORIES, EQUIPMENT, MUSCLES } from "../lib/workout";

type T = TFunction<"training">;

/** "Smith Machine" → "smithMachine", "front delts" → "frontDelts" */
export function labelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ _]+(\w)/g, (_, letter: string) => letter.toUpperCase());
}

const KNOWN_CATEGORIES = new Set<string>(CATEGORIES);
const KNOWN_EQUIPMENT = new Set<string>([...EQUIPMENT, ...EQUIPMENT_BUCKETS]);
const KNOWN_MUSCLES = new Set<string>(MUSCLES);

function translate(t: T, key: string): string {
  return t(key as ParseKeys<"training">);
}

export function categoryLabel(t: T, category: string): string {
  return KNOWN_CATEGORIES.has(category)
    ? translate(t, `categories.${labelKey(category)}`)
    : category;
}

export function equipmentLabel(t: T, equipment: string): string {
  return KNOWN_EQUIPMENT.has(equipment)
    ? translate(t, `equipment.${labelKey(equipment)}`)
    : equipment;
}

export function muscleLabel(t: T, muscle: string): string {
  return KNOWN_MUSCLES.has(muscle)
    ? translate(t, `muscles.${labelKey(muscle)}`)
    : muscle;
}
