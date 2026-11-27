/** The OFF and USDA quality filters' active tiers */
import { OFF_TIERS, USDA_TIERS } from "../lib/externalFoods";

export interface TierFilters {
  off: ReadonlySet<string>;
  usda: ReadonlySet<string>;
}

export function allTiers(): TierFilters {
  return { off: new Set(OFF_TIERS), usda: new Set(USDA_TIERS) };
}
