import { describe, expect, it, vi } from "vitest";

import fixture from "./fixtures/off-nutrition-sets.json";
import { asSoldNutriments } from "./offNutritionSets";
import {
  mapFullOffProduct,
  mapOffProduct,
  type OffProduct,
} from "./openFoodFacts";
import { offNutritionStatus } from "./offStatus";
import type { GetJson } from "./types";

// Real OFF products as v3 and v3.5 return them (upstream's fixtures)
interface Sample {
  v3: OffProduct & {
    code: string;
    serving_quantity?: unknown;
    nutriments: Record<string, unknown>;
    nutrition_data_per?: string;
  };
  v3_5: { nutrition: { input_sets: { preparation: string }[] } };
}
const P = fixture.products as unknown as Record<string, Sample>;

const asSoldKeys = (nutriments: Record<string, unknown>) =>
  Object.keys(nutriments).filter(
    (key) =>
      /^[a-z0-9-]+_(100g|serving|modifier)$/.test(key) &&
      !key.includes("_prepared") &&
      !key.includes("-estimate-from-ingredients"),
  );

function reply(body: unknown) {
  return vi.fn(() => Promise.resolve(body));
}
const asGetJson = (mock: ReturnType<typeof reply>) =>
  mock as unknown as GetJson;

describe("asSoldNutriments against OFF", () => {
  it.each([
    "as_sold_only_15_digits",
    "as_sold_only_serving_tie",
    "as_sold_only_per_serving_set",
    "as_sold_only_salt_per_serving",
    "as_sold_only_salt_per_serving_2",
    "as_sold_only_per_unitless_quantity",
  ])("gives OFF's own values: %s", (name) => {
    const { v3, v3_5 } = P[name];
    const ours = asSoldNutriments(v3_5.nutrition, v3.serving_quantity);
    expect(ours).not.toBeNull();
    const keys = new Set([
      ...asSoldKeys(v3.nutriments),
      ...asSoldKeys(ours?.nutriments ?? {}),
    ]);
    expect(keys.size).toBeGreaterThan(10);
    for (const key of keys) {
      expect(ours?.nutriments[key], key).toBe(v3.nutriments[key]);
    }
    expect(ours?.per).toBe(v3.nutrition_data_per);
    for (const importPortion of ["per100g", "perServing"]) {
      const merged = mapOffProduct(
        {
          ...v3,
          nutriments: ours?.nutriments,
          nutrition_data_per: ours?.per,
        },
        { importPortion },
        true,
      );
      const plain = mapOffProduct(v3, { importPortion }, true);
      expect(merged?.nutrition).toEqual(plain?.nutrition);
      expect(merged?.offInfo?.present).toEqual(plain?.offInfo?.present);
      expect(merged?.portion).toBe(plain?.portion);
    }
  });
});

describe("mapFullOffProduct", () => {
  const cases: [string, number, string, Record<string, number>][] = [
    [
      "beans",
      64,
      "g",
      { proteins: 5.166, fat: 0.4, carbohydrates: 7.56, fiber: 4.41 },
    ],
    ["nesquik", 386, "g", {}],
    ["benco", 377, "g", {}],
    ["formula_bio", 495, "g", {}],
    ["formula_optipro", 67, "ml", {}],
    ["hot_chocolate_serving_only", 390, "g", {}],
  ];

  it.each(cases)(
    "finds the as-sold values: %s",
    async (name, kcal, basis, more) => {
      const { v3, v3_5 } = P[name];
      expect(mapOffProduct(v3, {}, true)?.offInfo?.isPreparedOnly).toBe(true);
      const getJson = reply({ status: "success", product: v3_5 });
      const food = await mapFullOffProduct(asGetJson(getJson), v3, v3.code);
      expect(getJson).toHaveBeenCalledExactlyOnceWith(
        `https://world.openfoodfacts.org/api/v3.5/product/${v3.code}?fields=nutrition`,
        false,
      );
      expect(Math.round(food?.nutrition.calories ?? 0)).toBe(kcal);
      expect(food?.nutrition_basis).toBe(basis);
      expect(food?.nutrition).toMatchObject(more);
      expect(food?.offInfo?.present).toContain("calories");
      expect(food && offNutritionStatus(food)).toBe("ok");
    },
  );

  it("keeps the as-prepared offer when as-sold has no calories", async () => {
    const { v3, v3_5 } = P.formula_sugars_only_as_sold;
    const food = await mapFullOffProduct(
      asGetJson(reply({ status: "success", product: v3_5 })),
      v3,
      v3.code,
    );
    expect(food?.offInfo?.present).toEqual([]);
    expect(food && offNutritionStatus(food)).toBe("preparedOnly");
    expect(food?.offInfo?.prepared?.nutrition.calories).toBe(66);
  });

  it("asks nothing more for a product with as-sold values", async () => {
    const { v3 } = P.as_sold_only_15_digits;
    const getJson = reply(null);
    await mapFullOffProduct(asGetJson(getJson), v3, v3.code);
    expect(getJson).not.toHaveBeenCalled();
  });

  it("keeps v3's answer on anything unexpected, asking live", async () => {
    const { v3 } = P.beans;
    const withoutAsSold = P.beans.v3_5.nutrition.input_sets.filter(
      (set) => set.preparation !== "as_sold",
    );
    const answers: (() => Promise<unknown>)[] = [
      () => Promise.reject(new Error("offline")),
      () => Promise.resolve({ status: "failure", product: null }),
      () =>
        Promise.resolve({
          status: 1,
          product: { code: v3.code, nutriments: v3.nutriments },
        }),
      () =>
        Promise.resolve({
          status: "success",
          product: { nutrition: { input_sets: withoutAsSold } },
        }),
      () =>
        Promise.resolve({
          status: "success",
          product: { nutrition: { input_sets: "x" } },
        }),
    ];
    for (const answer of answers) {
      const getJson = vi.fn(answer);
      const food = await mapFullOffProduct(
        getJson as unknown as GetJson,
        v3,
        v3.code,
        { isLive: true },
      );
      expect(getJson).toHaveBeenCalledWith(expect.any(String), true);
      expect(food?.nutrition.calories).toBe(0);
      expect(food && offNutritionStatus(food)).toBe("preparedOnly");
    }
  });
});

describe("asSoldNutriments edge cases", () => {
  const set = (nutrients: object, extra: object = {}) => ({
    input_sets: [
      {
        preparation: "as_sold",
        source: "packaging",
        per: "100g",
        per_quantity: 100,
        per_unit: "g",
        nutrients,
        ...extra,
      },
    ],
  });

  it("never throws or invents a value on bad input", () => {
    for (const bad of [
      undefined,
      null,
      {},
      { input_sets: null },
      { input_sets: "x" },
      { input_sets: [null, 1, "x"] },
      { input_sets: [{ preparation: "as_sold" }] },
      set("x" as unknown as object),
      set({ fat: { value: 1, unit: "g" } }, { source: "estimate" }),
    ]) {
      expect(asSoldNutriments(bad, 30), JSON.stringify(bad)).toBeNull();
    }
  });

  it("skips unknown units and converts like OFF", () => {
    const odd = asSoldNutriments(
      set({
        fat: { value: 5, unit: "blorps" },
        proteins: { value: 3, unit: "g" },
      }),
      undefined,
    );
    expect(odd?.nutriments.fat_100g).toBeUndefined();
    expect(odd?.nutriments.proteins_100g).toBe(3);
    const units = asSoldNutriments(
      set({
        sodium: { value: 400, unit: "mg" },
        "vitamin-d": { value: 400, unit: "IU" },
        "energy-kj": { value: 1000, unit: "kJ" },
      }),
      undefined,
    );
    expect(units?.nutriments.sodium_100g).toBe(0.4);
    expect(units?.nutriments["vitamin-d_100g"]).toBe(0.00001);
    expect(units?.nutriments.energy_100g).toBe(1000);
    expect(
      asSoldNutriments(
        set(
          { fat: { value: 1, unit: "g" } },
          { per: "serving", per_quantity: 2 },
        ),
        undefined,
      ),
    ).toBeNull();
    expect(
      asSoldNutriments(
        set({ sodium: { value_computed: 0.2, unit: "g" } }),
        undefined,
      )?.nutriments.sodium_modifier,
    ).toBe("~");
  });

  it("takes each nutrient from the first set that lists it", () => {
    const base = {
      preparation: "as_sold",
      per: "100g",
      per_quantity: 100,
      per_unit: "g",
    };
    const result = asSoldNutriments(
      {
        input_sets: [
          {
            ...base,
            source: "packaging",
            nutrients: {
              fat: { unit: "g" },
              proteins: { value: 2, unit: "g" },
            },
          },
          {
            ...base,
            source: "manufacturer",
            nutrients: { proteins: { value: 3, unit: "g" } },
          },
          {
            ...base,
            source: "usda",
            nutrients: { fat: { value: 9, unit: "g" } },
          },
        ],
      },
      undefined,
    );
    expect(result?.nutriments.proteins_100g).toBe(3);
    expect(result?.nutriments.fat_100g).toBe(0);
  });

  it("rounds per-serving values as OFF does", () => {
    const kj = (value: number, serving: number) =>
      asSoldNutriments(set({ "energy-kj": { value, unit: "kJ" } }), serving)
        ?.nutriments["energy-kj_serving"];
    expect(kj(1225, 100)).toBe(1220);
    expect(kj(1235, 100)).toBe(1240);
    expect(kj(1592.857142857143, 7)).toBe(111);
  });

  it("reads a per quantity without a unit as grams", () => {
    const result = asSoldNutriments(
      set(
        {
          calcium: { value: 0.26, unit: "g" },
          "added-sugars": { value: 9, unit: "g" },
        },
        { per: "serving", per_quantity: 67, per_unit: null },
      ),
      67,
    );
    expect(result?.nutriments.calcium_100g).toBe(0.388059701492537);
    expect(result?.nutriments["added-sugars_100g"]).toBe(13.4328358208955);
    expect(result?.per).toBe("100g");
  });
});
