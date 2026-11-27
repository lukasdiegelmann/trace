import { describe, expect, it, vi } from "vitest";

import { api, ApiError, SessionExpiredError } from "@/api";

import { labelFields, parseJsonReply } from "./aiChat";
import {
  canonicalizeBarcode,
  mapOffProduct,
  mapUsdaFood,
  ntSearch,
  offContributionParams,
  offCountryFilter,
  offLookupBarcode,
  offTier,
  rankOffResults,
  rankUsdaResults,
} from "./externalFoods";

const preferences = { language: "de", country: "World" };

describe("Open Food Facts", () => {
  it("pads 12-digit UPC codes", () => {
    expect(canonicalizeBarcode("012345678905")).toBe("0012345678905");
    expect(canonicalizeBarcode("4001234567890")).toBe("4001234567890");
  });

  it("maps a product and drops estimated values", () => {
    const food = mapOffProduct({
      product_name: " Oats ",
      brands: "Acme, Other",
      code: "1",
      nutriments: {
        "energy-kcal_100g": 370,
        fat_100g: 7,
        sugars_100g: 1,
        sugars_modifier: "~",
        sodium_100g: 0.01,
      },
      completeness: 0.5,
      origins_tags: ["en:germany"],
    });
    expect(food).toMatchObject({
      name: "Oats",
      brand: "Acme",
      serving_size: 100,
      originTag: "en:germany",
      nutrition: { calories: 370, fat: 7, sugars: 0, sodium: 10 },
    });
    expect(mapOffProduct({ code: "1" })).toBeNull();
  });

  it("ranks by image, completeness and Nutri-Score", () => {
    expect(
      rankOffResults([
        { name: "a", completeness: 0.9 },
        { name: "b", img_url: "x", completeness: 0.1 },
        { name: "c", completeness: 0.9, nutriscore: "a" },
      ]).map((food) => food.name),
    ).toEqual(["b", "c", "a"]);
    expect([0.8, 0.5, 0.1, null].map(offTier)).toEqual([
      "hi",
      "mid",
      "lo",
      "unknown",
    ]);
    expect(offCountryFilter("United Kingdom")).toBe("en:united-kingdom");
    expect(offCountryFilter("World")).toBeNull();
  });

  it("looks a barcode up through the proxy", async () => {
    const get = vi.spyOn(api.ct, "get").mockResolvedValue({
      status: "success",
      product: { product_name: "Oats" },
    });
    await expect(
      offLookupBarcode("012345678905", preferences),
    ).resolves.toMatchObject({ name: "Oats" });
    expect(get).toHaveBeenCalledWith("/proxy", {
      query: {
        url: "https://world.openfoodfacts.org/api/v3/product/0012345678905?lc=de",
      },
    });
    get.mockRejectedValueOnce(new ApiError("ct", 404, null));
    await expect(offLookupBarcode("1", preferences)).resolves.toBeNull();
    get.mockRestore();
  });

  it("builds the contribution query with the guest account", () => {
    const params = offContributionParams(
      { name: "Oats", barcode: "1", nutrition: { calories: 370 } },
      { username: "", password: "", uploadCountry: "Auto" },
      "de-DE",
    );
    expect(params.get("user_id")).toBe("cooktrace-app");
    expect(params.get("product_name_de")).toBe("Oats");
    expect(params.get("nutriment_energy-kcal")).toBe("370");
    expect(params.has("countries")).toBe(false);
  });
});

describe("USDA and NutriTrace", () => {
  it("normalises to 100 g and net carbs", () => {
    const food = mapUsdaFood({
      description: "Bread",
      servingSize: 50,
      fdcId: 9,
      foodNutrients: [
        { nutrientId: 1005, value: 25 },
        { nutrientId: 1079, value: 3 },
        { nutrientId: 1008, value: 100 },
      ],
    });
    expect(food.nutrition).toMatchObject({
      carbohydrates: 44,
      fiber: 6,
      calories: 200,
      kilojoules: 836.8,
    });
    expect(food.barcode).toBe("fdcId_9");
    expect(
      rankUsdaResults([
        { name: "b", dataType: "Branded" },
        { name: "f", dataType: "Foundation" },
      ])[0]?.name,
    ).toBe("f");
  });

  it("treats a disabled federation as no results, not a lost session", async () => {
    const get = vi
      .spyOn(api.ct, "get")
      .mockRejectedValueOnce(new ApiError("ct", 503, null));
    await expect(ntSearch("oats")).resolves.toEqual([]);
    get.mockRejectedValueOnce(new SessionExpiredError("ct", null));
    await expect(ntSearch("oats")).rejects.toBeInstanceOf(SessionExpiredError);
    get.mockRestore();
  });
});

describe("label scan", () => {
  it("finds the JSON in fenced or chatty replies", () => {
    expect(parseJsonReply('```json\n{"fat": 1}\n```')).toEqual({ fat: 1 });
    expect(parseJsonReply('Sure: {"fat": 2} ok')).toEqual({ fat: 2 });
    expect(parseJsonReply("nothing")).toBeNull();
  });

  it("maps the label onto the draft's fields", () => {
    expect(
      labelFields({
        name: "Bar",
        portion: "40",
        unit: "g",
        fat: 3,
        proteins: "x",
        junk: 1,
      }),
    ).toEqual({
      name: "Bar",
      serving_size: 40,
      serving_unit: "g",
      nutrition: { fat: 3 },
    });
  });
});
