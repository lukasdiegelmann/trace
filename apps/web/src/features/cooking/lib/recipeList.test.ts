import { describe, expect, it } from "vitest";

import type { Recipe } from "../recipesApi";

import {
  categoriesOf,
  filterRecipes,
  filterShared,
  membershipChanges,
  mixShared,
  pantryMatch,
  sortRecipes,
  toSortMode,
} from "./recipeList";

function recipe(values: Partial<Recipe> & { id: number }): Recipe {
  return {
    name: `R${values.id}`,
    description: null,
    tags: [],
    category: null,
    favorite: false,
    cook_count: 0,
    last_cooked_at: null,
    created_at: null,
    ...values,
  } as Recipe;
}

const recipes = [
  recipe({
    id: 1,
    name: "Zupfkuchen",
    cook_count: 1,
    created_at: "2026-01-02",
  }),
  recipe({
    id: 2,
    name: "Crème brûlée",
    favorite: true,
    last_cooked_at: "2026-05-01",
    category: { id: 1, name: "Dessert", slug: "dessert", color: null },
  }),
  recipe({ id: 3, name: "Apfelmus", cook_count: 4, tags: ["Vegan"] }),
];
const names = (list: Recipe[]) => list.map((r) => r.id);

describe("recipe list", () => {
  it("sorts in the five modes", () => {
    expect(names(sortRecipes(recipes, "alpha"))).toEqual([3, 2, 1]);
    expect(names(sortRecipes(recipes, "fav-alpha"))).toEqual([2, 3, 1]);
    expect(names(sortRecipes(recipes, "most"))).toEqual([3, 1, 2]);
    expect(names(sortRecipes(recipes, "recent"))).toEqual([2, 3, 1]);
    expect(names(sortRecipes(recipes, "newest"))).toEqual([1, 3, 2]);
    expect(toSortMode("bogus")).toBe("fav-alpha");
  });

  it("searches accent-folded and combines filters", () => {
    const base = {
      categorySlug: "",
      isFavoritesOnly: false,
      sort: "alpha" as const,
    };
    const search = (query: string) =>
      names(filterRecipes(recipes, { ...base, query }));
    expect(search("creme")).toEqual([2]);
    expect(search("vegan")).toEqual([3]);
    expect(search("dessert")).toEqual([2]);
    expect(
      names(
        filterRecipes(recipes, {
          ...base,
          query: "",
          categorySlug: "dessert",
          isFavoritesOnly: true,
        }),
      ),
    ).toEqual([2]);
  });

  it("searches who shared a recipe, and mixes without duplicates", () => {
    const shared = [recipe({ id: 4, shared_by: "Alex" }), recipe({ id: 1 })];
    expect(
      names(
        filterShared(shared, {
          query: "alex",
          categorySlug: "",
          sort: "alpha",
        }),
      ),
    ).toEqual([4]);
    expect(names(mixShared(recipes, shared, true))).toEqual([1, 2, 3, 4]);
    expect(mixShared(recipes, shared, false)).toHaveLength(3);
    expect(categoriesOf(recipes).map((c) => c.slug)).toEqual(["dessert"]);
  });

  it("grades the pantry match and diffs memberships", () => {
    expect(pantryMatch({ have: 2, need: 2 })).toBe("full");
    expect(pantryMatch({ have: 1, need: 2 })).toBe("partial");
    expect(pantryMatch({ have: 0, need: 2 })).toBe("none");
    expect(pantryMatch({ have: 0, need: 0 })).toBeNull();
    expect(membershipChanges(new Set([1, 3]), new Set([1, 2]))).toEqual({
      added: [3],
      removed: [2],
    });
  });
});
