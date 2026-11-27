import { describe, expect, it } from "vitest";

import {
  DEFAULT_VISIBLE_NUTRIMENT_IDS,
  deriveSodiumSalt,
  displayEnergy,
  dvPercent,
  formatNutrient,
  hasNutritionValues,
  isDerived,
  nutrimentById,
  nutrimentDepth,
  scaleNutrition,
  setNutrient,
  visibleNutrimentIds,
  type Nutrition,
} from "./nutriments";

describe("nutriments", () => {
  it("knows the defaults and the visible setting", () => {
    expect(DEFAULT_VISIBLE_NUTRIMENT_IDS).toContain("calories");
    expect(DEFAULT_VISIBLE_NUTRIMENT_IDS).not.toContain("kilojoules");
    expect(visibleNutrimentIds(null)).toBe(DEFAULT_VISIBLE_NUTRIMENT_IDS);
    expect(visibleNutrimentIds(["iron"])).toEqual(["iron"]);
  });

  it("computes % daily value", () => {
    expect(dvPercent(nutrimentById("sodium"), 230)).toBe(10);
    expect(dvPercent(nutrimentById("sugars"), 10)).toBeNull();
    expect(dvPercent(nutrimentById("fat"), "")).toBeNull();
  });

  it("derives salt from sodium and the other way", () => {
    const fromSodium = deriveSodiumSalt<Nutrition>({ sodium: 400 });
    expect(fromSodium.salt).toBe(1);
    expect(isDerived(fromSodium, "salt")).toBe(true);
    const fromSalt = deriveSodiumSalt<Nutrition>({ salt: 2.5 });
    expect(fromSalt.sodium).toBe(1000);
    expect(isDerived(fromSalt, "sodium")).toBe(true);
    expect(deriveSodiumSalt({ salt: 1, sodium: 3 })).toEqual({
      salt: 1,
      sodium: 3,
    });
  });

  it("typing sodium replaces a derived salt", () => {
    let nutrition = setNutrient({}, "salt", "1");
    expect(nutrition.sodium).toBe(400);
    nutrition = setNutrient(nutrition, "sodium", "800");
    expect(nutrition.salt).toBe(2);
    expect(isDerived(nutrition, "salt")).toBe(true);
    expect(isDerived(nutrition, "sodium")).toBe(false);
    nutrition = setNutrient(nutrition, "fat", "");
    expect("fat" in nutrition).toBe(false);
  });

  it("scales linked to the serving size", () => {
    const scaled = scaleNutrition(
      deriveSodiumSalt({ fat: 10, sodium: 400 }),
      2,
    );
    expect(scaled.fat).toBe(20);
    expect(scaled.sodium).toBe(800);
    expect(scaled.salt).toBe(2);
  });

  it("formats and displays", () => {
    expect(displayEnergy(100, "kJ")).toBe(418);
    expect(displayEnergy(99.6, "kcal")).toBe(100);
    expect(displayEnergy("", "kcal")).toBeNull();
    expect(formatNutrient(15.02, "mg")).toBe("15mg");
    expect(formatNutrient(1.25, "g")).toBe("1.3g");
    const added = nutrimentById("added-sugars");
    expect(added && nutrimentDepth(added)).toBe(2);
    expect(hasNutritionValues({ _derived: {} })).toBe(false);
    expect(hasNutritionValues({ fat: 0 })).toBe(true);
  });
});
