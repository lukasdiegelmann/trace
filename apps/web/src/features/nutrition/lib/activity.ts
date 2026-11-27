/**
 * The activity compendium (2024 Adult Compendium subset), its search, the
 * MET calorie estimate and the name suggestions, ported from
 * nutritrace/src/lib/activity-picker.js and AddActivitySheet.svelte.
 */
import type { ActivityRow } from "../api";
import compendium from "./activityCompendium.json";
import { foldText } from "./searchText";

export interface CompendiumActivity {
  id: string;
  category: string;
  name: string;
  met: number;
}

export const ACTIVITIES: readonly CompendiumActivity[] = compendium.activities;

/** Exercise categories first, daily life last */
export const CATEGORY_ORDER = [
  "Running",
  "Bicycling",
  "Walking",
  "Water",
  "Winter",
  "Sports",
  "Conditioning",
  "Dancing",
  "Home",
  "Occupation",
] as const;

export type ActivityCategory = (typeof CATEGORY_ORDER)[number];

export function groupedByCategory(): {
  category: ActivityCategory;
  activities: CompendiumActivity[];
}[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    activities: ACTIVITIES.filter((entry) => entry.category === category),
  })).filter((group) => group.activities.length > 0);
}

/** Ranked: name starts with, name contains, category contains */
export function searchCompendium(query: string): CompendiumActivity[] {
  const needle = foldText(query).trim();
  if (!needle) return [];
  const starts: CompendiumActivity[] = [];
  const names: CompendiumActivity[] = [];
  const categories: CompendiumActivity[] = [];
  for (const activity of ACTIVITIES) {
    const name = foldText(activity.name);
    if (name.startsWith(needle)) starts.push(activity);
    else if (name.includes(needle)) names.push(activity);
    else if (foldText(activity.category).includes(needle)) {
      categories.push(activity);
    }
  }
  return [...starts, ...names, ...categories];
}

/** MET × kg × hours; null when something is missing */
export function metKcal(input: {
  met: unknown;
  weightKg: unknown;
  durationMin: unknown;
}): number | null {
  const met = Number(input.met);
  const weight = Number(input.weightKg);
  const minutes = Number(input.durationMin);
  if (![met, weight, minutes].every((n) => Number.isFinite(n) && n > 0)) {
    return null;
  }
  return Math.round(met * weight * (minutes / 60));
}

export interface ActivitySuggestions {
  templates: ActivityRow[];
  past: ActivityRow[];
}

/** Templates (≤12) and past names (≤50), newest first, one per name */
export function activityHistory(rows: ActivityRow[]): ActivitySuggestions {
  const sorted = [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  );
  const unique = (list: ActivityRow[], limit: number) => {
    const seen = new Set<string>();
    const out: ActivityRow[] = [];
    for (const row of list) {
      const key = foldText(row.name).trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length === limit) break;
    }
    return out;
  };
  return {
    templates: unique(
      sorted.filter((row) => row.is_template),
      12,
    ),
    past: unique(sorted, 50),
  };
}

export interface WeightReading {
  kg: number;
  date: string;
}

/** The newer of the diary's and the scale's weight; a tie goes to the diary */
export function newerWeight(
  diary: WeightReading | null,
  wellness: WeightReading | null,
): WeightReading | null {
  if (!diary) return wellness;
  if (!wellness) return diary;
  return wellness.date > diary.date ? wellness : diary;
}
