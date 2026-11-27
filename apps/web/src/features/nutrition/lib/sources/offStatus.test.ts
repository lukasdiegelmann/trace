import { describe, expect, it } from "vitest";

import beans from "./fixtures/off-241-prepared-only.json";
import samples from "./fixtures/off-prepared-samples.json";
import { mapOffProduct, type OffProduct } from "./openFoodFacts";
import {
  hasNoOffValues,
  needsFullLookup,
  offNotice,
  offNutritionStatus,
} from "./offStatus";
import type { OffInfo } from "./types";

const REAL = samples.products as unknown as Record<string, OffProduct>;
const full = (product: OffProduct) => mapOffProduct(product, {}, true);

describe("real as-prepared products", () => {
  it("keeps them apart from the saved food", () => {
    for (const [kind, product] of Object.entries(REAL)) {
      const food = full(product);
      expect(food?.offInfo?.isPreparedOnly, kind).toBe(true);
      expect(food?.offInfo?.present, kind).toEqual([]);
      expect(food?.nutrition.calories, kind).toBe(0);
      expect(food?.offInfo?.prepared?.present, kind).toContain("calories");
    }
    const drink = full(REAL.drink)?.offInfo?.prepared;
    expect(drink?.unit).toBe("ml");
    expect(drink?.nutrition.calories).toBe(72);
  });

  it("offers them when plausible only", () => {
    const status = (product: OffProduct) => {
      const food = full(product);
      return food && offNutritionStatus(food);
    };
    expect(status(REAL.drink)).toBe("preparedOnly");
    expect(status(REAL.formula_prepared)).toBe("preparedOnly");
    expect(status(REAL.formula_powder_in_prepared)).toBe("preparedOnly");
    expect(status(REAL.impossible)).toBe("implausible");
    expect(status(beans.product as unknown as OffProduct)).toBe("preparedOnly");
    expect(
      status({
        code: "9100000007540",
        product_name: "Skyr",
        nutriments: { "energy-kcal_100g": 58 },
      }),
    ).toBe("ok");
    expect(status({ code: "1", product_name: "Empty" })).toBe("none");
  });
});

describe("offNutritionStatus", () => {
  const info: OffInfo = {
    present: [],
    isPreparedOnly: true,
    isFull: true,
    prepared: {
      present: ["calories"],
      nutrition: { calories: 72 },
      derived: {},
      portion: 100,
      unit: "g",
    },
  };

  it("never flags saved, barcode-less or unknown foods", () => {
    expect(offNutritionStatus({ id: 7, barcode: "1" }, info)).toBe("ok");
    expect(offNutritionStatus({ barcode: "" }, info)).toBe("ok");
    expect(offNutritionStatus({ barcode: "1" }, null)).toBe("ok");
    expect(offNutritionStatus(null, info)).toBe("ok");
  });

  it("never flags a food with calories of its own", () => {
    const none: OffInfo = { ...info, isPreparedOnly: false, prepared: null };
    expect(
      offNutritionStatus({ barcode: "1", nutrition: { calories: 120 } }, none),
    ).toBe("ok");
    expect(
      offNutritionStatus({ barcode: "1", nutrition: { calories: 0 } }, none),
    ).toBe("none");
    expect(offNutritionStatus({ barcode: "1" }, none)).toBe("none");
  });

  it("asks for the full product only for a hit without values", () => {
    const hit = mapOffProduct({ code: "4", product_name: "X" });
    expect(needsFullLookup(hit?.offInfo)).toBe(true);
    expect(hit && hasNoOffValues(hit)).toBe(true);
    const complete = full({
      code: "4",
      product_name: "X",
      nutriments: { "energy-kcal_100g": 50 },
    });
    expect(needsFullLookup(complete?.offInfo)).toBe(false);
    expect(complete && hasNoOffValues(complete)).toBe(false);
  });

  it("builds the editor's notice", () => {
    expect(offNotice("1", info)).toMatchObject({
      status: "preparedOnly",
      kcal: 72,
      unit: "g",
    });
    expect(offNotice("1", { ...info, present: ["calories"] })).toBeNull();
  });
});
