/** The cases of nutritrace/scripts/alt-units-diary.test.js (#237) */
import { describe, expect, it } from "vitest";

import { amountAndUnit, parseAltUnits, scaleFactor, unitSystem } from "./units";

const SLICE = [{ abbr: "slice", grams: 54.7 }];
const breadString = { nutrition_basis: "g", alt_units: JSON.stringify(SLICE) };
const breadArray = { nutrition_basis: "g", alt_units: SLICE };
const kcalFor = (factor: number) => ((241 * 54.7) / 100) * factor;

describe("scaleFactor", () => {
  it("converts a household unit to grams, with alt_units as a string", () => {
    expect(scaleFactor(1, "slice", 66, "g", breadString)).toBeCloseTo(
      66 / 54.7,
      9,
    );
  });

  it("gives the reporter's 159 kcal, not ~8,700", () => {
    expect(
      Math.round(kcalFor(scaleFactor(1, "slice", 66, "g", breadString))),
    ).toBe(159);
    expect(
      Math.round(kcalFor(scaleFactor(1, "slice", 66, "g", breadArray))),
    ).toBe(159);
  });

  it("works from grams to slices too", () => {
    expect(scaleFactor(109.4, "g", 1, "slice", breadString)).toBeCloseTo(
      54.7 / 109.4,
      9,
    );
    expect(scaleFactor(2, "slice", 1, "slice", breadString)).toBeCloseTo(
      0.5,
      9,
    );
  });

  it("gives the same answer for string and array shapes", () => {
    let seed = 237;
    const random = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
    const units = [
      "g",
      "kg",
      "oz",
      "ml",
      "cup",
      "tbsp",
      "slice",
      "cookie",
      "piece",
      "serving",
      "SLICE",
    ];
    for (let i = 0; i < 5000; i++) {
      const alt = Array.from({ length: 1 + Math.floor(random() * 3) }, () => ({
        abbr: pick(["slice", "cookie", "piece"]),
        grams: Math.round(random() * 20000) / 100,
      }));
      const base = {
        nutrition_basis: pick(["g", "ml"]),
        density_g_ml: random() < 0.5 ? 1.03 : undefined,
      };
      const args = [
        Math.round(random() * 5000) / 10 || 1,
        pick(units),
        Math.round(random() * 5000) / 10 || 1,
        pick(units),
      ] as const;
      const asArray = scaleFactor(...args, { ...base, alt_units: alt });
      const asString = scaleFactor(...args, {
        ...base,
        alt_units: JSON.stringify(alt),
      });
      expect(Object.is(asArray, asString) || asArray === asString).toBe(true);
    }
  });

  it("treats malformed alt_units like none", () => {
    for (const bad of [
      "",
      "not json",
      '{"abbr":"slice"}',
      "null",
      '"slice"',
      "42",
      null,
      undefined,
      {},
      7,
    ]) {
      expect(
        scaleFactor(1, "slice", 66, "g", {
          nutrition_basis: "g",
          alt_units: bad,
        }),
      ).toBe(
        scaleFactor(1, "slice", 66, "g", {
          nutrition_basis: "g",
          alt_units: null,
        }),
      );
    }
  });

  it("bridges volume to mass with density, else falls back to the ratio", () => {
    const honey = { nutrition_basis: "g", density_g_ml: 1.42 };
    expect(scaleFactor(100, "g", 1, "tbsp", honey)).toBeCloseTo(
      (14.787 * 1.42) / 100,
      9,
    );
    expect(scaleFactor(100, "g", 1, "tbsp", { nutrition_basis: "g" })).toBe(
      0.01,
    );
    expect(scaleFactor(100, "g", 250, "g")).toBe(2.5);
    expect(scaleFactor(0, "g", 50, "g")).toBe(0.5);
  });
});

describe("helpers", () => {
  it("parseAltUnits returns a list or null", () => {
    expect(parseAltUnits(SLICE)).toEqual(SLICE);
    expect(parseAltUnits(JSON.stringify(SLICE))).toEqual(SLICE);
    expect(parseAltUnits("[]")).toEqual([]);
    for (const value of [
      "",
      "not json",
      "{}",
      "null",
      '"x"',
      null,
      undefined,
      {},
      3,
    ]) {
      expect(parseAltUnits(value)).toBeNull();
    }
  });

  it("amountAndUnit spaces only named units", () => {
    expect(amountAndUnit(500, "g")).toBe("500g");
    expect(amountAndUnit(8, "Nugget(s)")).toBe("8 Nugget(s)");
    expect(amountAndUnit(1, "cup")).toBe("1 cup");
    expect(amountAndUnit(3, null)).toBe("3g");
  });

  it("unitSystem tells mass from volume", () => {
    expect(unitSystem("oz")).toBe("g");
    expect(unitSystem("fl oz")).toBe("ml");
    expect(unitSystem("piece")).toBeNull();
  });
});
