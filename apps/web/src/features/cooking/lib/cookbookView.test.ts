import { describe, expect, it } from "vitest";

import type { CookbookRecipe } from "../cookbooksApi";

import { viewCookbookRecipes } from "./cookbookView";

const recipes = [
  { id: 1, name: "Zebra", favorite: false },
  { id: 2, name: "Éclair", favorite: true },
  { id: 3, name: "Apple", locked: true },
] as CookbookRecipe[];

const ids = (list: CookbookRecipe[]) => list.map((r) => r.id);

describe("viewCookbookRecipes", () => {
  it("keeps the stored order, or sorts a copy", () => {
    expect(ids(viewCookbookRecipes(recipes, "", "manual"))).toEqual([1, 2, 3]);
    expect(ids(viewCookbookRecipes(recipes, "", "alpha"))).toEqual([3, 2, 1]);
    expect(ids(viewCookbookRecipes(recipes, "", "fav"))).toEqual([2, 3, 1]);
    expect(ids(recipes)).toEqual([1, 2, 3]);
  });

  it("searches names without accents", () => {
    expect(ids(viewCookbookRecipes(recipes, "ecl", "manual"))).toEqual([2]);
  });
});
