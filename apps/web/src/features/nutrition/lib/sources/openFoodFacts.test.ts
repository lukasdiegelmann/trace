import { describe, expect, it, vi } from "vitest";

import {
  completeOffFood,
  hydrateOffHit,
  isOffSuccess,
  lookupBarcode,
  luceneEscape,
  mapOffProduct,
  offSearchUrl,
  resolveOffPicks,
  searchOff,
} from "./openFoodFacts";
import type { GetJson } from "./types";

function fake(answer: (url: string) => unknown) {
  const mock = vi.fn((url: string) =>
    Promise.resolve().then(() => answer(url)),
  );
  return { mock, getJson: mock as unknown as GetJson };
}

const PRODUCT = {
  code: "4000",
  product_name: "Bread",
  brands: "Baker, Other",
  serving_size: "1 slice (35 g)",
  serving_quantity: "35",
  nutrition_data_per: "100g",
  origins_tags: ["en:germany"],
  nutriments: {
    "energy-kcal_100g": 250,
    "energy-kcal_serving": 87.5,
    proteins_100g: 8,
    proteins_serving: 2.8,
    salt_100g: 1.2,
    sodium_100g: 0.48,
    "vitamin-b1_100g": 0.0002,
    fiber_100g: "",
    fat_100g: 3,
    fat_modifier: "~",
  },
};

describe("mapOffProduct", () => {
  it("maps per 100 g and records what OFF really has", () => {
    const food = mapOffProduct(PRODUCT);
    expect(food).toMatchObject({
      source: "off",
      name: "Bread",
      brand: "Baker",
      barcode: "4000",
      portion: 100,
      unit: "g",
      nutrition_basis: "g",
      alt_units: [{ abbr: "slice", grams: 35 }],
      originTag: "en:germany",
    });
    expect(food?.nutrition).toMatchObject({
      calories: 250,
      sodium: 480,
      b1: 0.2,
      fat: 0,
      fiber: 0,
    });
    expect([...(food?.offInfo?.present ?? [])].sort()).toEqual([
      "b1",
      "calories",
      "proteins",
      "salt",
      "sodium",
    ]);
  });

  it("imports per serving when set and the product has it", () => {
    const food = mapOffProduct(PRODUCT, { importPortion: "perServing" });
    expect(food?.portion).toBe(35);
    expect(food?.nutrition).toMatchObject({ calories: 87.5, proteins: 2.8 });
  });

  it("derives sodium from salt and falls back from kJ", () => {
    const food = mapOffProduct({
      product_name: "x",
      serving_size: "30 g",
      serving_quantity: 30,
      nutriments: { energy_100g: 418.4, salt_100g: 1 },
    });
    expect(food?.nutrition).toMatchObject({ calories: 100, sodium: 400 });
    expect(food?.derived).toEqual({ sodium: true, salt: false });
    expect(food?.alt_units).toBeNull();
  });

  it("skips products without a name", () => {
    expect(mapOffProduct({ code: "1" })).toBeNull();
  });
});

describe("search URL", () => {
  it("escapes Lucene and adds the country filter", () => {
    expect(luceneEscape('M&&M\'s "x" a||b (1:2)')).toBe(
      'M\\&\\&M\'s \\"x\\" a\\|\\|b \\(1\\:2\\)',
    );
    const url = new URL(
      offSearchUrl('say "hi"', 2, 50, {
        country: "New Zealand",
        language: "de-DE",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://search.openfoodfacts.org/search",
    );
    expect(url.searchParams.get("q")).toBe(
      'say \\"hi\\" +countries_tags:"en:new-zealand"',
    );
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("langs")).toBe("de");
  });

  it("has no filter for World", () => {
    const url = new URL(offSearchUrl("milk", 1, 20, { country: "World" }));
    expect(url.searchParams.get("q")).toBe("milk");
    expect(url.searchParams.get("langs")).toBe("en");
  });
});

describe("requests", () => {
  it("accepts every found envelope", () => {
    expect(isOffSuccess({ status: 1 })).toBe(true);
    expect(isOffSuccess({ status: "success_with_warnings" })).toBe(true);
    expect(isOffSuccess({ status: "failure" })).toBe(false);
    expect(isOffSuccess(null)).toBe(false);
  });

  it("searches both envelopes and pages", async () => {
    const { getJson } = fake(() => ({ products: [PRODUCT, {}], count: 80 }));
    const page = await searchOff(getJson, "bread");
    expect(page.items).toHaveLength(1);
    expect(page).toMatchObject({ totalHits: 80, page: 1, hasMore: true });
    const hits = fake(() => ({ hits: [PRODUCT] }));
    expect(await searchOff(hits.getJson, "bread", 2)).toMatchObject({
      totalHits: 1,
      hasMore: false,
    });
    await searchOff(hits.getJson, "  ");
    expect(hits.mock).toHaveBeenCalledTimes(1);
  });

  it("tells not found from a failure", async () => {
    const missing = fake(() => ({ status: "failure" }));
    expect(await lookupBarcode(missing.getJson, "1")).toBeNull();
    const gone = fake(() => {
      throw Object.assign(new Error("Upstream 404"), { status: 404 });
    });
    expect(await lookupBarcode(gone.getJson, "1")).toBeNull();
    const down = fake(() => {
      throw Object.assign(new Error("down"), { status: 503 });
    });
    await expect(lookupBarcode(down.getJson, "1")).rejects.toThrow("down");
  });

  it("looks up live in the chosen language", async () => {
    const { mock, getJson } = fake(() => ({
      status: "success",
      product: PRODUCT,
    }));
    const food = await lookupBarcode(getJson, "4000", {
      isLive: true,
      language: "de",
    });
    expect(food?.offInfo?.isFull).toBe(true);
    expect(mock).toHaveBeenCalledWith(
      "https://world.openfoodfacts.org/api/v3/product/4000?lc=de",
      true,
    );
  });

  it("completes hits and drops picks without values", async () => {
    const empty = mapOffProduct({ code: "4000", product_name: "Bread" });
    const none = mapOffProduct({ code: "5", product_name: "Air" });
    if (!empty || !none) throw new Error("unmapped");
    const { getJson } = fake((url) =>
      url.includes("/4000")
        ? { status: 1, product: PRODUCT }
        : { status: 1, product: { code: "5", product_name: "Air" } },
    );
    expect((await completeOffFood(getJson, empty)).status).toBe("ok");
    const refused = await completeOffFood(getJson, none);
    expect(refused.status).toBe("none");
    expect(refused.food.offInfo?.isFull).toBe(true);
    const saved = { id: 1, name: "Mine" };
    const resolved = await resolveOffPicks(getJson, [saved, empty, none]);
    expect(resolved.keep.map((pick) => pick.name)).toEqual(["Mine", "Bread"]);
    expect(resolved.skipped).toEqual(["Air"]);
    const hydrated = await hydrateOffHit(getJson, empty);
    expect(hydrated.alt_units).toEqual([{ abbr: "slice", grams: 35 }]);
  });
});

describe("brand tags of the search API", () => {
  it("drops the language prefix", () => {
    expect(
      mapOffProduct({ code: "1", product_name: "A", brands: ["xx:Ferrero"] })
        ?.brand,
    ).toBe("Ferrero");
  });
});
