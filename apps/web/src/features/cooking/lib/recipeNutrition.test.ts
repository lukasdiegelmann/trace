import { describe, expect, it } from "vitest";

import {
  computeRecipeMass,
  computeRecipeNutrition,
  convertQty,
  lookupCommonDensity,
  perServing,
  unitFamily,
  type NutritionPantryRow,
} from "./recipeNutrition";

const rows: NutritionPantryRow[] = [
  {
    id: 1,
    name: "Flour",
    serving_size: 100,
    serving_unit: "g",
    g_per_cup: 125,
    nutrition: { calories: 364 },
  },
  {
    id: 2,
    name: "Milk",
    serving_size: 100,
    serving_unit: "ml",
    nutrition: { calories: 50 },
  },
  { id: 3, name: "Yeast" },
  {
    id: 4,
    name: "Oil (generic)",
    nutrition_source_variant_id: 5,
  },
  {
    id: 5,
    name: "Olive oil",
    generic_parent_id: 4,
    serving_size: 10,
    serving_unit: "g",
    nutrition: { calories: 90 },
  },
];
const pantry = new Map(rows.map((row) => [row.id, row]));

describe("units", () => {
  it("knows the families and bridges them by density", () => {
    expect(unitFamily("cup")).toBe("volume");
    expect(unitFamily("kg")).toBe("weight");
    expect(unitFamily("clove")).toBe("count");
    expect(unitFamily("")).toBeNull();
    expect(convertQty(1, "kg", "g")).toBe(1000);
    expect(convertQty(1, "cup", "g", 125)).toBeCloseTo(125);
    expect(convertQty(125, "g", "cup", 125)).toBeCloseTo(1);
    expect(convertQty(1, "cup", "g")).toBeNull();
    expect(convertQty(2, "clove", "clove")).toBe(2);
  });

  it("looks up the most specific density first", () => {
    expect(lookupCommonDensity("Almond Flour")).not.toBe(
      lookupCommonDensity("All-purpose flour"),
    );
    expect(lookupCommonDensity("unobtainium")).toBeNull();
  });
});

describe("computeRecipeNutrition", () => {
  it("sums linked ingredients and explains the skipped ones", () => {
    const result = computeRecipeNutrition(
      [
        {
          items: [
            { name: "Flour", qty: "1", unit: "cup", pantry_item_id: 1 },
            { name: "Milk", qty: "100", unit: "g", pantry_item_id: 2 },
            { name: "Yeast", qty: "1", unit: "g", pantry_item_id: 3 },
            { name: "Oil", qty: "10", unit: "g", pantry_item_id: 4 },
            { name: "Salt", qty: "to taste", pantry_item_id: 1 },
            { name: "", qty: "1" },
          ],
        },
      ],
      pantry,
    );
    expect(result.total).toBe(6);
    expect(result.used).toBe(2);
    expect(result.nutrition.calories).toBe(545);
    expect(result.skipped.map((s) => s.reason.code)).toEqual([
      "needsDensity",
      "noNutrition",
      "noQuantity",
    ]);
    expect(perServing(result.nutrition, 4)).toEqual({ calories: 136.25 });
    expect(perServing(result.nutrition, 0)).toEqual({ calories: 545 });
  });

  it("weighs a serving only when everything can be weighed", () => {
    expect(
      computeRecipeMass(
        {
          servings: 2,
          ingredients: [{ items: [{ name: "Flour", qty: "200", unit: "g" }] }],
        },
        pantry,
      ),
    ).toEqual({ perServingG: 100, isComplete: true });
    expect(
      computeRecipeMass(
        { ingredients: [{ items: [{ name: "Egg", qty: "2", unit: "pc" }] }] },
        pantry,
      ),
    ).toEqual({ perServingG: null, isComplete: false });
  });
});
