import { describe, expect, it } from "vitest";

import type { MealItem, MealRow } from "../api";
import {
  addIngredients,
  applyCooktraceRefresh,
  autoUpdateRecipeAmount,
  changeIngredientAmount,
  cloneMealWrite,
  defaultIngredientAmount,
  emptyMealForm,
  ingredientAmountOf,
  ingredientFrom,
  ingredientTotal,
  mealFormFromPrefill,
  mealFormFromRow,
  mealFormToWrite,
  mealTotals,
  moveIngredient,
  perServing,
  recipeServings,
  recipeTotalWeight,
  removeIngredient,
  reorderIngredients,
  setIngredientAmount,
  staleIngredientNames,
  validateMealForm,
} from "./mealForm";
import { mapCooktraceRecipe } from "./sources/cooktrace";
import { withDerivedFlags } from "./sources/types";

const item = (fields: Partial<MealItem> = {}): MealItem => ({
  name: "x",
  portion: 100,
  unit: "g",
  quantity: 1,
  nutrition: { calories: 100 },
  ...fields,
});

const row = (fields: Partial<MealRow> = {}): MealRow => ({
  id: 3,
  user_id: 1,
  name: "Soup",
  nutrition: { calories: 100 },
  items: [item({ portion: 1000, nutrition: { calories: 400 } })],
  img_url: null,
  notes: null,
  is_recipe: true,
  portion: 250,
  unit: "g",
  servings: 4,
  created_at: "",
  visibility: "private",
  source_id: null,
  source_app: null,
  source_external_id: null,
  source_url: null,
  updated_at: null,
  deleted_at: null,
  favorite: 0,
  usage_count: 0,
  last_used_at: null,
  ...fields,
});

describe("ingredients", () => {
  const food = {
    id: 1,
    name: "Bread",
    portion: 100,
    unit: "g",
    img_url: "/uploads/b.jpg",
    nutrition: withDerivedFlags(
      { calories: 250, salt: 1, sodium: 400 },
      { sodium: true },
    ),
    alt_units: [{ abbr: "slice", grams: 35 }],
    _shared_by: "x",
  };

  it("snapshots a food scaled to the amount, keeping the flags", () => {
    const result = ingredientFrom(food, {
      portion: "2",
      unit: "slice",
      quantity: "2",
    });
    expect(result).toMatchObject({
      id: 1,
      portion: 4,
      unit: "slice",
      quantity: 1,
      imgUrl: "/uploads/b.jpg",
      alt_units: food.alt_units,
    });
    expect(result.nutrition.calories).toBeCloseTo(350);
    expect(result.nutrition).toHaveProperty("_derived", { sodium: true });
    expect(result).not.toHaveProperty("img_url");
    expect(result).not.toHaveProperty("_shared_by");
  });

  it("rescales from what the ingredient holds", () => {
    const stored = ingredientFrom(food, defaultIngredientAmount(food));
    const changed = changeIngredientAmount(stored, {
      portion: "50",
      unit: "g",
      quantity: 3,
    });
    expect(changed).toMatchObject({ portion: 150, quantity: 1 });
    expect(changed.nutrition.calories).toBeCloseTo(375);
    expect(changed.nutrition).toHaveProperty("_derived", { sodium: true });
    expect(ingredientTotal({ portion: "", unit: "g", quantity: "2" })).toBe(
      200,
    );
  });

  it("keeps an empty unit", () => {
    const egg = item({ portion: 4, unit: "" });
    const changed = changeIngredientAmount(egg, {
      ...ingredientAmountOf(egg),
      portion: 2,
    });
    expect([changed.unit, changed.nutrition.calories]).toEqual(["", 50]);
  });

  it("moves and reorders", () => {
    expect(moveIngredient([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveIngredient([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    expect(reorderIngredients([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
  });

  it("totals with custom nutriments", () => {
    expect(
      mealTotals([
        item({ nutrition: { calories: 1, q10: 2 } }),
        item({ nutrition: { calories: 2, q10: 3 } }),
      ]),
    ).toEqual({ calories: 3, q10: 5 });
  });
});

describe("recipe weight", () => {
  const items = [
    item({ portion: 500, quantity: 2 }),
    item({ portion: 1, unit: "cup" }),
    item({
      portion: 2,
      unit: "slice",
      alt_units: [{ abbr: "slice", grams: 35 }],
    }),
    item({ portion: 4, unit: "" }),
    item({ portion: 1, unit: "serving" }),
  ];

  it("converts, includes quantity and skips weightless units", () => {
    expect(recipeTotalWeight(items, "g")).toBeCloseTo(1306.588);
    expect(recipeTotalWeight(items, "kg")).toBeCloseTo(1.306588);
    expect(recipeTotalWeight(items, "slice")).toBeNull();
  });

  it("keeps the chosen unit", () => {
    const form = { ...emptyMealForm(true), recipeUnit: "kg", items };
    expect(autoUpdateRecipeAmount(form)).toMatchObject({
      recipeAmount: "1.31",
      recipeUnit: "kg",
    });
    const manual = { ...form, recipeUnit: "piece", recipeAmount: "8" };
    expect(autoUpdateRecipeAmount(manual).recipeAmount).toBe("8");
    expect(removeIngredient({ ...form, items: [items[0]] }, 0)).toMatchObject({
      items: [],
      recipeAmount: "",
    });
  });
});

describe("form and saving", () => {
  it("reads servings, legacy blank included", () => {
    expect(mealFormFromRow(row())).toMatchObject({
      recipeAmount: "1000",
      recipeYields: "4",
    });
    expect(mealFormFromRow(row({ servings: null }))).toMatchObject({
      recipeAmount: "250",
      recipeYields: "",
    });
    expect(recipeServings("")).toEqual({ servings: 1, isExplicit: false });
    expect(recipeServings("0")).toEqual({ servings: 1, isExplicit: true });
  });

  it("stores a recipe per serving", () => {
    const write = mealFormToWrite(mealFormFromRow(row()));
    expect(write).toMatchObject({
      portion: 250,
      unit: "g",
      servings: 4,
      nutrition: { calories: 100 },
      favorite: false,
      notes: "",
      img_url: null,
    });
    expect(
      mealFormToWrite(mealFormFromRow(row({ servings: null }))).servings,
    ).toBeNull();
  });

  it("weighs the ingredients when no amount was typed", () => {
    const form = {
      ...emptyMealForm(true),
      name: "x",
      recipeYields: "2",
      items: [item({ quantity: 2 })],
    };
    expect(mealFormToWrite(form).portion).toBe(100);
    expect(mealFormToWrite({ ...form, items: [] }).portion).toBe(50);
  });

  it("stores a meal's totals without recipe fields", () => {
    const write = mealFormToWrite(
      addIngredients(emptyMealForm(false), [item(), item()]),
    );
    expect(write.nutrition).toEqual({ calories: 200 });
    expect(write).not.toHaveProperty("portion");
    expect(write).not.toHaveProperty("servings");
    expect(write).not.toHaveProperty("favorite");
  });

  it("trusts an imported rollup until the ingredients change", () => {
    const sourced = row({ source_app: "cooktrace" });
    // Saving again must not divide the stored per-serving values again
    expect(mealFormToWrite(mealFormFromRow(sourced)).nutrition).toEqual({
      calories: 100,
    });
    const edited = setIngredientAmount(mealFormFromRow(sourced), 0, {
      portion: 500,
      unit: "g",
      quantity: 1,
    });
    expect(edited.sourceNutrition).toBeNull();
    expect(mealFormToWrite(edited).nutrition).toEqual({ calories: 50 });
  });

  it("takes a CookTrace pick and a refresh", () => {
    const recipe = {
      id: 5,
      name: "Soup",
      servings: 2,
      portion: 300,
      unit: "g",
      nutrition: { calories: 150 },
      items: [{ name: "a", portion: 600, unit: "g" }],
    };
    const form = mealFormFromPrefill(mapCooktraceRecipe(recipe));
    expect(form).toMatchObject({ recipeAmount: "600", recipeYields: "2" });
    expect(mealFormToWrite(form)).toMatchObject({
      nutrition: { calories: 150 },
      source_app: "cooktrace",
      source_external_id: "recipe:5",
    });
    const fresh = applyCooktraceRefresh(form, {
      ...recipe,
      nutrition: { calories: 200 },
    });
    expect(mealFormToWrite(fresh).nutrition).toEqual({ calories: 200 });
  });

  it("previews a serving and validates", () => {
    expect(perServing(mealFormFromRow(row()))).toEqual({
      amount: 250,
      unit: "g",
      kcal: 100,
    });
    expect(perServing(emptyMealForm(true))).toBeNull();
    expect(validateMealForm(emptyMealForm(false))).toEqual([
      "nameRequired",
      "noIngredients",
    ]);
  });

  it("clones without the source ids", () => {
    const write = cloneMealWrite(
      row({ source_app: "cooktrace", source_external_id: "recipe:1" }),
      "Copy",
    );
    expect(write.name).toBe("Copy");
    expect(write).not.toHaveProperty("source_app");
    expect(write).not.toHaveProperty("source_external_id");
  });
});

// Upstream stale-ingredients.test.js
describe("staleIngredientNames", () => {
  const catalogue = [
    [
      { id: 7677, name: "Chicken breast" },
      { id: 7905, name: "Rice" },
    ],
    [],
    [],
  ];

  it("names what is gone, in meal order", () => {
    expect(
      staleIngredientNames(
        [
          { id: 7285, name: "Olive oil" },
          { id: 7677, name: "Chicken breast" },
          { id: 7286, name: "Butter" },
        ],
        catalogue,
      ),
    ).toEqual(["Olive oil", "Butter"]);
  });

  it("accuses nobody without a catalogue or an id", () => {
    const items = [{ id: 7285, name: "Olive oil" }];
    expect(staleIngredientNames(items, [[], [], []])).toEqual([]);
    expect(staleIngredientNames(items, [])).toEqual([]);
    expect(staleIngredientNames(items, [null, undefined])).toEqual([]);
    expect(
      staleIngredientNames(
        [{ name: "Oil" }, { id: "off-1", name: "Nutella" }, { id: null }],
        catalogue,
      ),
    ).toEqual([]);
    for (const none of [[], null, undefined]) {
      expect(staleIngredientNames(none, catalogue)).toEqual([]);
    }
  });

  it("matches either id and any list", () => {
    const cache = [[{ id: 12, server_id: 7677 }]];
    for (const ids of [
      { id: 7677 },
      { id: 99, food_server_id: 7677 },
      { id: 12 },
    ]) {
      expect(staleIngredientNames([{ ...ids, name: "c" }], cache)).toEqual([]);
    }
    expect(
      staleIngredientNames(
        [{ id: 2200, name: "Sofrito" }],
        [[{ id: 1 }], [{ id: 2200 }]],
      ),
    ).toEqual([]);
  });
});
