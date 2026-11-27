/**
 * Filtering, counting, sorting and grouping of the exercise library, after
 * backends/lifttrace/src/routes/Exercises.svelte.
 */
import { normalizeEquipment, sortByBucket } from "./equipment";
import { foldText } from "./searchText";

export interface ListedExercise {
  id: number;
  name: string;
  category?: string | null;
  equipment?: string[] | null;
}

export interface ExerciseUsage {
  count?: number;
  last_date?: string | null;
}
export type UsageById = Partial<Record<string, ExerciseUsage>>;

export type SortMode = "alpha" | "used" | "recent";
export const SORT_MODES: SortMode[] = ["alpha", "used", "recent"];

export interface ListFilters {
  search: string;
  /** "" shows every category */
  category: string;
  /** Empty: no filter. Entries are buckets or exact custom strings */
  equipment: string[];
}

function matchesSearch(exercise: ListedExercise, search: string): boolean {
  return !search || foldText(exercise.name).includes(foldText(search));
}

/** A selected entry matches the raw string exactly or through its bucket */
export function matchesEquipment(
  exercise: ListedExercise,
  selected: string[],
): boolean {
  if (!selected.length) return true;
  const wanted = new Set(selected);
  return (exercise.equipment ?? []).some((raw) => {
    const bucket = normalizeEquipment(raw);
    return wanted.has(raw) || (bucket !== "" && wanted.has(bucket));
  });
}

export function filterExercises<T extends ListedExercise>(
  exercises: T[],
  filters: ListFilters,
): T[] {
  return exercises.filter(
    (exercise) =>
      matchesSearch(exercise, filters.search) &&
      (!filters.category || exercise.category === filters.category) &&
      matchesEquipment(exercise, filters.equipment),
  );
}

/** Per category, after search and equipment (not the chosen category) */
export function categoryCounts(
  exercises: ListedExercise[],
  filters: ListFilters,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const exercise of filterExercises(exercises, {
    ...filters,
    category: "",
  })) {
    const category = exercise.category || "other";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

export interface EquipmentOption {
  name: string;
  count: number;
  isCustom: boolean;
}

/**
 * The equipment chips for the current search and category: buckets first,
 * then the user's custom kit that some exercise uses. An exercise counts at
 * most once per chip.
 */
export function equipmentOptions(
  exercises: ListedExercise[],
  filters: ListFilters,
  customEquipment: string[],
): EquipmentOption[] {
  const custom = new Set(customEquipment);
  const buckets = new Map<string, number>();
  const customs = new Map<string, number>();
  for (const exercise of filterExercises(exercises, {
    ...filters,
    equipment: [],
  })) {
    const seenBuckets = new Set<string>();
    const seenCustom = new Set<string>();
    for (const raw of exercise.equipment ?? []) {
      if (custom.has(raw)) seenCustom.add(raw);
      const bucket = normalizeEquipment(raw);
      if (bucket) seenBuckets.add(bucket);
    }
    for (const b of seenBuckets) buckets.set(b, (buckets.get(b) ?? 0) + 1);
    for (const c of seenCustom) customs.set(c, (customs.get(c) ?? 0) + 1);
  }
  return [
    ...[...buckets]
      .sort(([a], [b]) => sortByBucket(a, b))
      .map(([name, count]) => ({ name, count, isCustom: false })),
    ...[...customs]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count, isCustom: true })),
  ];
}

/** Favorites first, then the sort mode, then the name */
export function sortExercises<T extends ListedExercise>(
  exercises: T[],
  mode: SortMode,
  usage: UsageById,
  favorites: number[],
): T[] {
  const favorite = new Set(favorites);
  return [...exercises].sort((a, b) => {
    const byFavorite = Number(favorite.has(b.id)) - Number(favorite.has(a.id));
    if (byFavorite) return byFavorite;
    if (mode === "used") {
      const byCount = (usage[b.id]?.count ?? 0) - (usage[a.id]?.count ?? 0);
      if (byCount) return byCount;
    } else if (mode === "recent") {
      const lastA = usage[a.id]?.last_date ?? "";
      const lastB = usage[b.id]?.last_date ?? "";
      if (lastA !== lastB) return lastB < lastA ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export interface ExerciseGroup<T> {
  /** A category id, or "" for the one flat list */
  category: string;
  exercises: T[];
}

/**
 * A→Z groups by category (one group when a category is chosen); "Most used"
 * and "Recent" are one flat list so their order is global.
 */
export function groupExercises<T extends ListedExercise>(
  filtered: T[],
  mode: SortMode,
  category: string,
  usage: UsageById,
  favorites: number[],
): ExerciseGroup<T>[] {
  if (mode !== "alpha" || category) {
    const key = mode === "alpha" ? category : "";
    return filtered.length
      ? [
          {
            category: key,
            exercises: sortExercises(filtered, mode, usage, favorites),
          },
        ]
      : [];
  }
  const groups = new Map<string, T[]>();
  for (const exercise of filtered) {
    const key = exercise.category || "other";
    const list = groups.get(key);
    if (list) list.push(exercise);
    else groups.set(key, [exercise]);
  }
  return [...groups].map(([key, list]) => ({
    category: key,
    exercises: sortExercises(list, mode, usage, favorites),
  }));
}

export interface RelativeAge {
  value: number;
  unit: "day" | "week" | "month" | "year";
}

/** How long ago a day was (from its local noon), as the row's "3d ago" */
export function relativeAge(
  date: string,
  now: number = Date.now(),
): RelativeAge {
  const days = Math.max(
    0,
    Math.round((now - new Date(`${date}T12:00:00`).getTime()) / 86400000),
  );
  if (days < 7) return { value: days, unit: "day" };
  if (days < 30) return { value: Math.round(days / 7), unit: "week" };
  if (days < 365) return { value: Math.round(days / 30), unit: "month" };
  return { value: Math.round(days / 365), unit: "year" };
}

/** "today", "yesterday", "3 days ago", in the app's language */
export function formatRelativeAge(age: RelativeAge, language: string): string {
  return new Intl.RelativeTimeFormat(language, {
    numeric: "auto",
    style: "short",
  }).format(age.value === 0 ? 0 : -age.value, age.unit);
}
