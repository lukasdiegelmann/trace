import { describe, expect, it, vi } from "vitest";

import type { GetJson } from "./types";
import {
  mapUsdaFood,
  searchUsda,
  USDA_TIERS,
  usdaBadge,
  usdaTier,
} from "./usda";

describe("mapUsdaFood", () => {
  it("scales to 100 and takes fiber out of the carbs", () => {
    const food = mapUsdaFood(
      {
        fdcId: 171688,
        description: " Apple ",
        brandName: "Farm",
        dataType: "SR Legacy",
        foodNutrients: [
          { nutrientId: 1008, value: 26 },
          { nutrient: { id: 1005 }, amount: 7 },
          { nutrientId: 1079, value: 1.2 },
          { nutrientId: 2000, value: 5 },
          { nutrientId: 1093, value: 200 },
          { nutrientId: 9999, value: 1 },
        ],
      },
      50,
    );
    expect(food).toMatchObject({
      name: "Apple",
      brand: "Farm",
      barcode: "fdcId_171688",
      portion: 100,
      unit: "g",
      dataType: "SR Legacy",
    });
    expect(food.nutrition).toEqual({
      calories: 52,
      kilojoules: 217.6,
      carbohydrates: 11.6,
      fiber: 2.4,
      sugars: 10,
      sodium: 400,
      salt: 1,
    });
    expect(food.derived).toEqual({ salt: true, sodium: false });
  });

  it("never drops carbs below sugars and keeps millilitres", () => {
    const food = mapUsdaFood(
      {
        gtinUpc: "123",
        description: "x",
        servingSizeUnit: "ML",
        foodNutrients: [
          { nutrientId: 1005, value: 10 },
          { nutrientId: 1079, value: 5 },
          { nutrientId: 2000, value: 8 },
        ],
      },
      100,
    );
    expect(food.nutrition.carbohydrates).toBe(8);
    expect(food.unit).toBe("ml");
    expect(food.barcode).toBe("123");
  });
});

describe("tiers", () => {
  it("names every data type and its badge", () => {
    expect(usdaTier("Survey (FNDDS)")).toBe("Survey");
    expect(usdaTier(null)).toBe("Unknown");
    expect(USDA_TIERS.map(usdaBadge)).toEqual(["F", "L", "S", "B", "X", "?"]);
    expect(usdaBadge("Survey (FNDDS)")).toBe("S");
  });
});

describe("searchUsda", () => {
  it("ranks curated tiers first and pages", async () => {
    const mock = vi.fn((url: string) =>
      Promise.resolve({
        url,
        foods: [
          { fdcId: 1, description: "b", dataType: "Branded" },
          { fdcId: 2, description: "f", dataType: "Foundation" },
          { fdcId: 3, description: "" },
        ],
        totalHits: 60,
        totalPages: 2,
      }),
    );
    const page = await searchUsda(mock as unknown as GetJson, "a b", 1, "key");
    expect(page.items.map((food) => food.name)).toEqual(["f", "b"]);
    expect(page.hasMore).toBe(true);
    expect(mock).toHaveBeenCalledWith(
      "https://api.nal.usda.gov/fdc/v1/foods/search?query=a%20b&pageSize=50&pageNumber=1&api_key=key",
    );
  });

  it("does nothing without a key", async () => {
    const mock = vi.fn();
    await searchUsda(mock, "a", 1, "");
    expect(mock).not.toHaveBeenCalled();
  });
});
