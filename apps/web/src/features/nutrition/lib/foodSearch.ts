/**
 * Searching, sorting and filtering the library, ported from
 * nutritrace/src/routes/Foods.svelte (`_fuzzyMatch`, `_applySort`), the
 * MealEditor's picker and the category helpers of stores/settings.js.
 * Unlike upstream the match ignores accents (`foldText`).
 */

import type { FoodCategory } from "../settings";
import { foldText } from "./searchText";

/** Levenshtein distance; 99 when the lengths differ by more than 2 */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1]
          : 1 + Math.min(previous[j], row[j - 1], previous[j - 1]);
    }
    previous = row;
  }
  return previous[b.length];
}

export interface Searchable {
  name?: string | null;
  brand?: string | null;
}

/**
 * In name + brand: the query as a substring, or every word of it, or every
 * word (4+ letters) within one edit of a word (3+ letters).
 */
export function matchesFood(food: Searchable, query: string): boolean {
  const wanted = foldText(query).trim();
  if (!wanted) return true;
  const haystack = foldText(`${food.name ?? ""} ${food.brand ?? ""}`);
  if (haystack.includes(wanted)) return true;
  const words = wanted.split(/\s+/);
  if (words.length > 1 && words.every((word) => haystack.includes(word))) {
    return true;
  }
  const targets = haystack.split(/\s+/);
  return words.every(
    (word) =>
      word.length >= 4 &&
      targets.some(
        (target) => target.length >= 3 && editDistance(word, target) <= 1,
      ),
  );
}

/** The `foodsSort`, `mealsSort` and `recipesSort` settings */
export type LibrarySort = "alpha" | "recent" | "most";

export interface Sortable extends Searchable {
  last_used_at?: string | null;
  usage_count?: number | null;
  favorite?: number | boolean | null;
  category?: string | null;
}

function compareNames(a: Sortable, b: Sortable): number {
  return (a.name ?? "").localeCompare(b.name ?? "");
}

function compareRecent(a: Sortable, b: Sortable): number {
  const left = a.last_used_at ?? "";
  const right = b.last_used_at ?? "";
  if (left && right) return right.localeCompare(left);
  if (left) return -1;
  if (right) return 1;
  return compareNames(a, b);
}

function compareMost(a: Sortable, b: Sortable): number {
  return (b.usage_count ?? 0) - (a.usage_count ?? 0) || compareNames(a, b);
}

/** A sorted copy; any other mode is alphabetical */
export function sortLibrary<T extends Sortable>(
  items: readonly T[],
  mode: string,
): T[] {
  const compare =
    mode === "recent"
      ? compareRecent
      : mode === "most"
        ? compareMost
        : compareNames;
  return [...items].sort(compare);
}

export function pinFavorites<T extends Sortable>(items: readonly T[]): T[] {
  return [
    ...items.filter((item) => item.favorite),
    ...items.filter((item) => !item.favorite),
  ];
}

/** "" shows every category */
export function filterByCategory<T extends Sortable>(
  items: readonly T[],
  category: string,
): T[] {
  return category
    ? items.filter((item) => item.category === category)
    : [...items];
}

export interface LibraryView {
  sort: string;
  query?: string;
  category?: string;
  /**
   * `unfiltered` (default, the Foods page): favourites on top without a query
   * or category; `always` is the MealEditor's picker
   */
  pinning?: "unfiltered" | "always";
}

export function arrangeLibrary<T extends Sortable>(
  items: readonly T[],
  view: LibraryView,
): T[] {
  const query = view.query?.trim() ?? "";
  const category = view.category ?? "";
  const found = filterByCategory(
    sortLibrary(items, view.sort).filter((item) => matchesFood(item, query)),
    category,
  );
  return view.pinning === "always" || (!query && !category)
    ? pinFavorites(found)
    : found;
}

export function categoryName(category: FoodCategory): string {
  return typeof category === "string" ? category : category.name;
}

export function categoryLabel(category: FoodCategory): string {
  return typeof category === "string" ? "" : (category.label ?? "");
}

/** With the label (an emoji) when `foodsShowLabels` is on */
export function categoryDisplay(
  category: FoodCategory,
  shouldShowLabel: boolean,
): string {
  const label = categoryLabel(category);
  return shouldShowLabel && label
    ? `${label} ${categoryName(category)}`
    : categoryName(category);
}
