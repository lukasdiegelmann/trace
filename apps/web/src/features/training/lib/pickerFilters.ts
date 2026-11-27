/**
 * The exercise picker's filters, ported from LiftTrace
 * `ExercisePicker.svelte`: a search, one category and one equipment chip.
 * Matching and counting are the exercise library's (`exerciseList`).
 */
import type { ListFilters } from "./exerciseList";

export interface PickerFilters {
  search: string;
  category: string;
  equipment: string;
}

export const EMPTY_FILTERS: PickerFilters = {
  search: "",
  category: "",
  equipment: "",
};

/**
 * The library's filter shape. The search is trimmed (the old picker didn't,
 * so "bench " found nothing).
 */
export function toListFilters(filters: PickerFilters): ListFilters {
  return {
    search: filters.search.trim(),
    category: filters.category,
    equipment: filters.equipment ? [filters.equipment] : [],
  };
}

/** Whether a row's name is the search, case aside, both trimmed */
export function hasExactMatch(
  exercises: readonly { name: string }[],
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  return exercises.some((ex) => ex.name.trim().toLowerCase() === needle);
}

/** Reads the picker's filters back from sessionStorage's JSON */
export function parseStoredFilters(raw: string | null): PickerFilters {
  try {
    const parsed = JSON.parse(raw ?? "{}") as Partial<
      Record<keyof PickerFilters, unknown>
    > | null;
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    return {
      search: text(parsed?.search),
      category: text(parsed?.category),
      equipment: text(parsed?.equipment),
    };
  } catch {
    return { ...EMPTY_FILTERS };
  }
}
