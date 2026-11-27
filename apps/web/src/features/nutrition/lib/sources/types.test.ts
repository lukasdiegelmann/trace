import { describe, expect, it } from "vitest";

import {
  appendUnique,
  derivedFlagsOf,
  externalFood,
  externalFoodKey,
  isExternalFood,
  toFoodWrite,
  toggleTier,
} from "./types";

describe("toFoodWrite", () => {
  it("builds the create body with the derived flags", () => {
    const write = toFoodWrite(
      externalFood("off", {
        name: "Skyr",
        barcode: "9100000007540",
        nutrition: { calories: 58, salt: 0.1, sodium: 40 },
        derived: { sodium: true, salt: false },
      }),
    );
    expect(write).toEqual({
      name: "Skyr",
      brand: "",
      nutrition: {
        calories: 58,
        salt: 0.1,
        sodium: 40,
        _derived: { sodium: true },
      },
      portion: 100,
      unit: "g",
      img_url: null,
      barcode: "9100000007540",
      nutrition_basis: null,
      alt_units: null,
    });
  });

  it("carries the source ids the server upserts by", () => {
    const write = toFoodWrite(
      externalFood("cooktracePantry", {
        name: "Flour",
        source_app: "cooktrace",
        source_external_id: "pantry:1",
      }),
    );
    expect(write.source_app).toBe("cooktrace");
    expect(write.source_external_id).toBe("pantry:1");
    expect(write.barcode).toBeNull();
  });
});

describe("helpers", () => {
  it("reads only truthy derived flags", () => {
    expect(derivedFlagsOf({ _derived: { salt: true, sodium: false } })).toEqual(
      { salt: true },
    );
    expect(derivedFlagsOf(null)).toEqual({});
  });

  it("tells picks from library rows", () => {
    expect(isExternalFood(externalFood("usda", {}))).toBe(true);
    expect(isExternalFood({ id: 1, name: "x" })).toBe(false);
  });

  it("appends a page without duplicates, even without barcodes", () => {
    const a = externalFood("usda", { name: "a" });
    const b = externalFood("usda", { name: "b" });
    expect(appendUnique([a], [a, b], externalFoodKey)).toEqual([a, b]);
  });

  it("never switches off the last tier", () => {
    expect([...toggleTier(new Set(["a", "b"]), "a")]).toEqual(["b"]);
    expect([...toggleTier(new Set(["b"]), "b")]).toEqual(["b"]);
  });
});
