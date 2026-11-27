/** The search and sort of a cookbook (CookbookView.svelte); view only */
import type { CookbookRecipe } from "../cookbooksApi";

import { foldText } from "./searchText";

export const COOKBOOK_SORTS = ["manual", "alpha", "fav"] as const;
export type CookbookSort = (typeof COOKBOOK_SORTS)[number];

const isFavorite = (recipe: CookbookRecipe) =>
  recipe.locked ? 0 : Number(recipe.favorite);

export function viewCookbookRecipes(
  recipes: readonly CookbookRecipe[],
  query: string,
  sort: CookbookSort,
): CookbookRecipe[] {
  const needle = foldText(query).trim();
  const found = recipes.filter((recipe) =>
    foldText(recipe.name).includes(needle),
  );
  if (sort === "manual") return found;
  return found.sort(
    (a, b) =>
      (sort === "fav" ? isFavorite(b) - isFavorite(a) : 0) ||
      a.name.localeCompare(b.name),
  );
}
