/**
 * "Look it up" of the pantry editor. The table is shared with the recipes;
 * once recipeNutrition.ts (issue #5) is on main, its lookupCommonDensity
 * replaces this.
 */
import { COMMON_DENSITIES } from "./densities";

/** A g_per_cup for an ingredient name, or null when none matches */
export function lookupCommonDensity(
  name: string | null | undefined,
): number | null {
  if (!name) return null;
  const needle = name.toLowerCase().trim();
  const match = COMMON_DENSITIES.find(([key]) => needle.includes(key));
  return match ? match[1] : null;
}
