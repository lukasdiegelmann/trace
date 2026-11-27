/**
 * What the recipe list shows: search, filters and sort, ported from
 * cooktrace/src/routes/Recipes.svelte.
 */
import { foldText } from "./searchText";
import type { Recipe, RecipeCategory } from "../recipesApi";

export const SORT_MODES = [
  "fav-alpha",
  "alpha",
  "recent",
  "most",
  "newest",
] as const;
export type SortMode = (typeof SORT_MODES)[number];

export function toSortMode(value: unknown): SortMode {
  return SORT_MODES.find((mode) => mode === value) ?? "fav-alpha";
}

export function sortRecipes(
  recipes: readonly Recipe[],
  mode: SortMode,
): Recipe[] {
  const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name);
  /** Newest first; rows without a value come last, by name */
  const byDateDesc =
    (key: "last_cooked_at" | "created_at") => (a: Recipe, b: Recipe) => {
      const left = a[key] ?? "";
      const right = b[key] ?? "";
      return right.localeCompare(left) || byName(a, b);
    };
  const compare = {
    alpha: byName,
    recent: byDateDesc("last_cooked_at"),
    newest: byDateDesc("created_at"),
    most: (a: Recipe, b: Recipe) =>
      (b.cook_count ?? 0) - (a.cook_count ?? 0) || byName(a, b),
    "fav-alpha": (a: Recipe, b: Recipe) =>
      Number(b.favorite) - Number(a.favorite) || byName(a, b),
  }[mode];
  return [...recipes].sort(compare);
}

/** Accent-folded substring over name, description, tags and category */
export function matchesQuery(
  recipe: Recipe,
  query: string,
  extra: (string | null | undefined)[] = [],
): boolean {
  const needle = foldText(query).trim();
  if (!needle) return true;
  return [
    recipe.name,
    recipe.description,
    ...recipe.tags,
    recipe.category?.name,
    ...extra,
  ].some((text) => foldText(text).includes(needle));
}

export interface ListFilter {
  query: string;
  categorySlug: string;
  isFavoritesOnly: boolean;
  sort: SortMode;
}

/** The own recipes, with the shared ones mixed in when that is set */
export function mixShared(
  own: readonly Recipe[],
  shared: readonly Recipe[],
  shouldMix: boolean,
): Recipe[] {
  if (!shouldMix) return [...own];
  const ownIds = new Set(own.map((recipe) => recipe.id));
  return [...own, ...shared.filter((recipe) => !ownIds.has(recipe.id))];
}

export function filterRecipes(
  recipes: readonly Recipe[],
  filter: ListFilter,
): Recipe[] {
  return sortRecipes(
    recipes.filter(
      (recipe) =>
        (!filter.isFavoritesOnly || recipe.favorite) &&
        (!filter.categorySlug ||
          recipe.category?.slug === filter.categorySlug) &&
        matchesQuery(recipe, filter.query),
    ),
    filter.sort,
  );
}

export function filterShared(
  recipes: readonly Recipe[],
  filter: Omit<ListFilter, "isFavoritesOnly">,
): Recipe[] {
  return sortRecipes(
    recipes.filter(
      (recipe) =>
        (!filter.categorySlug ||
          recipe.category?.slug === filter.categorySlug) &&
        matchesQuery(recipe, filter.query, [recipe.shared_by]),
    ),
    filter.sort,
  );
}

/** The categories the shared recipes use, in the order they first appear */
export function categoriesOf(recipes: readonly Recipe[]): RecipeCategory[] {
  const seen = new Map<string, RecipeCategory>();
  for (const { category } of recipes) {
    if (category && !seen.has(category.slug)) {
      seen.set(category.slug, category);
    }
  }
  return [...seen.values()];
}

export type PantryMatch = "full" | "partial" | "none";

export function pantryMatch(
  match: { have: number; need: number } | undefined,
): PantryMatch | null {
  if (!match || match.need <= 0) return null;
  if (match.have >= match.need) return "full";
  return match.have > 0 ? "partial" : "none";
}

/** Which memberships to add and remove after the checkboxes changed */
export function membershipChanges(
  selected: ReadonlySet<number>,
  before: ReadonlySet<number>,
): { added: number[]; removed: number[] } {
  return {
    added: [...selected].filter((id) => !before.has(id)),
    removed: [...before].filter((id) => !selected.has(id)),
  };
}
