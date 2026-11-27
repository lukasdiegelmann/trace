import { describe, expect, it } from "vitest";

import type { FoodRow, MealRow } from "../api";
import {
  diarySource,
  loggableFood,
  loggableRecipe,
  mealDiaryItems,
  storedAmount,
} from "./pickItems";

const bread = {
  id: 4,
  name: "Bread",
  brand: null,
  portion: 100,
  unit: "g",
  nutrition: { calories: 241, proteins: 9 },
  alt_units: [{ abbr: "slice", grams: 50 }],
  img_url: "/uploads/b.jpg",
} as unknown as FoodRow;

describe("diarySource", () => {
  it("stores the chosen portion's nutrition and the servings", () => {
    const source = diarySource(loggableFood(bread), {
      portion: 2,
      unit: "slice",
      quantity: 3,
    });
    expect(source).toMatchObject({
      id: 4,
      portion: 2,
      unit: "slice",
      quantity: 3,
      is_recipe: 0,
      imgUrl: "/uploads/b.jpg",
    });
    expect(source.nutrition.calories).toBeCloseTo(241);
  });

  it("keeps the stored amount by default", () => {
    const food = loggableFood(bread);
    expect(diarySource(food, storedAmount(food)).nutrition).toEqual({
      calories: 241,
      proteins: 9,
    });
  });

  it("marks a recipe", () => {
    const recipe = loggableRecipe({
      ...bread,
      is_recipe: true,
    } as unknown as MealRow);
    expect(diarySource(recipe, storedAmount(recipe)).is_recipe).toBe(1);
  });
});

describe("mealDiaryItems", () => {
  it("logs each ingredient on its own, keeping its food", () => {
    const meal = {
      id: 9,
      items: [
        {
          id: 4,
          name: "Bread",
          portion: 50,
          unit: "g",
          nutrition: { calories: 120 },
        },
        {
          name: "Jam",
          portion: 20,
          unit: "g",
          quantity: 2,
          nutrition: { calories: 50 },
        },
      ],
    } as unknown as MealRow;
    const items = mealDiaryItems(meal, 1);
    expect(
      items.map((i) => [i.name, i.meal, i.quantity, i.food_server_id]),
    ).toEqual([
      ["Bread", 1, 1, 4],
      ["Jam", 1, 2, null],
    ]);
    expect(new Set(items.map((i) => i.uuid)).size).toBe(2);
  });
});
