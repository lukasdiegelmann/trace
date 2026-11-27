import { describe, expect, it } from "vitest";

import {
  calculate,
  DEFAULT_VISIBLE_NUTRIMENT_IDS,
  deriveSodiumSalt,
  displayEnergy,
  dvPercent,
  energyInputToKcal,
  macroPercents,
  macroPercentsExact,
  nutrientById,
  NUTRIMENTS,
  parseExpression,
  round1,
  scaleNutrition,
  sumNutrition,
} from "./nutrition";

describe("nutriment definitions", () => {
  it("has unique ids and parents that exist", () => {
    const ids = NUTRIMENTS.map((nutrient) => nutrient.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const nutrient of NUTRIMENTS) {
      if (nutrient.subOf) expect(ids).toContain(nutrient.subOf);
    }
  });

  it("shows the label's usual rows by default", () => {
    expect(DEFAULT_VISIBLE_NUTRIMENT_IDS).toContain("calories");
    expect(DEFAULT_VISIBLE_NUTRIMENT_IDS).not.toContain("kilojoules");
  });

  it("computes the daily value only where there is one", () => {
    expect(dvPercent(nutrientById("fat"), 39)).toBe(50);
    expect(dvPercent(nutrientById("calories"), 39)).toBeNull();
    expect(dvPercent(nutrientById("fat"), "")).toBeNull();
  });
});

describe("calculate and sum", () => {
  it("multiplies by the number of servings and derives salt", () => {
    const totals = calculate({
      quantity: "2",
      nutrition: { calories: 100, sodium: 200, _derived: ["salt"] },
    });
    expect(totals).toEqual({ calories: 200, sodium: 400, salt: 1 });
  });

  it("adds up a split recipe's ingredients instead of the parent", () => {
    expect(
      calculate({
        nutrition: { calories: 999 },
        _splitItems: [
          { nutrition: { calories: 100 } },
          { quantity: 3, nutrition: { calories: 10 } },
        ],
      }).calories,
    ).toBe(130);
  });

  it("reads the legacy flat shape, calories_kcal included", () => {
    const legacy = { quantity: 2, calories_kcal: 50, proteins: 3 };
    expect(calculate(legacy)).toEqual({ calories: 100, proteins: 6 });
  });

  it("scales and sums numbers only", () => {
    expect(scaleNutrition({ calories: "10", note: "x" }, 3)).toEqual({
      calories: 30,
    });
    expect(sumNutrition([{ fat: 1 }, null, { fat: 2, iron: 1 }])).toEqual({
      fat: 3,
      iron: 1,
    });
  });
});

describe("sodium and salt", () => {
  it("fills only the missing one", () => {
    const fromSalt: Record<string, unknown> = { salt: 1.5 };
    expect(deriveSodiumSalt(fromSalt)).toBe("sodium");
    expect(fromSalt.sodium).toBe(600);
    expect(deriveSodiumSalt({ salt: 1, sodium: 1 })).toBeNull();
    expect(deriveSodiumSalt({})).toBeNull();
  });
});

describe("macro shares", () => {
  it("rounds each share of the macro calories", () => {
    expect(macroPercents({ fat: 10, carbohydrates: 10, proteins: 10 })).toEqual(
      { fat: 53, carbs: 24, protein: 24 },
    );
    expect(macroPercents(null)).toEqual({ fat: 0, carbs: 0, protein: 0 });
  });

  it("can make them add up to exactly 100", () => {
    const shares = macroPercentsExact({
      fat: 10,
      carbohydrates: 10,
      proteins: 10,
    });
    expect(shares.fat + shares.carbs + shares.protein).toBe(100);
    expect(
      macroPercentsExact({ fat: 0, carbohydrates: 0, proteins: 0 }),
    ).toEqual({ fat: 0, carbs: 0, protein: 0 });
  });
});

describe("energy and number input", () => {
  it("converts between kcal and kJ", () => {
    expect(displayEnergy(100, "kJ")).toBe(418);
    expect(displayEnergy("99.6", "kcal")).toBe(100);
    expect(energyInputToKcal(418.4, "kJ")).toBeCloseTo(100);
  });

  it("evaluates simple arithmetic and comma decimals without eval", () => {
    expect(parseExpression("2*50+10")).toBe(110);
    expect(parseExpression("(1,5+0,5)*3")).toBe(6);
    expect(parseExpression("12abc")).toBe(12);
    expect(parseExpression("")).toBe(0);
    expect(parseExpression("1/0")).toBe(0);
    expect(round1(1.25)).toBe(1.3);
  });
});
