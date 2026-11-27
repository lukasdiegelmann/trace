import { describe, expect, it } from "vitest";

import { calcPlates, convertWeight, countPlates, plateHeight } from "./plates";

describe("calcPlates", () => {
  it("loads 225 lbs as two 45s per side", () => {
    expect(calcPlates("225", "lbs")).toEqual({
      bar: 45,
      perSide: [45, 45],
      remainder: 0,
    });
  });

  it("loads 100 kg as 25 + 15 per side", () => {
    expect(calcPlates("100", "kg").perSide).toEqual([25, 15]);
  });

  it("uses the small plates greedily", () => {
    expect(calcPlates("62.5", "kg").perSide).toEqual([20, 1.25]);
    expect(calcPlates("140", "lbs").perSide).toEqual([45, 2.5]);
  });

  it("reports what the plates can't load, for both sides", () => {
    const load = calcPlates("101", "kg");
    expect(load.perSide).toEqual([25, 15]);
    expect(load.remainder).toBe(1);
    expect(calcPlates("226", "lbs").remainder).toBe(1);
  });

  it("needs no plates at or below the bar", () => {
    expect(calcPlates("20", "kg").perSide).toEqual([]);
    expect(calcPlates("40", "lbs").perSide).toEqual([]);
    expect(calcPlates("", "kg").perSide).toEqual([]);
    expect(calcPlates("abc", "lbs").perSide).toEqual([]);
  });

  it("needs no plates when not even the smallest fits", () => {
    expect(calcPlates("21", "kg")).toEqual({
      bar: 20,
      perSide: [],
      remainder: 1,
    });
  });
});

describe("countPlates", () => {
  it("counts each plate in the order it first appears", () => {
    expect(countPlates([45, 45, 25, 10, 10, 2.5])).toEqual([
      { plate: 45, count: 2 },
      { plate: 25, count: 1 },
      { plate: 10, count: 2 },
      { plate: 2.5, count: 1 },
    ]);
  });
});

describe("plateHeight", () => {
  it("scales with the plate and never drops below 28 px", () => {
    expect(plateHeight(25, "kg")).toBe(50);
    expect(plateHeight(1.25, "kg")).toBe(28);
    expect(plateHeight(45, "lbs")).toBe(42.5);
    expect(plateHeight(5, "lbs")).toBe(28);
  });
});

describe("convertWeight", () => {
  it("converts pounds to kilograms, 2 decimals", () => {
    expect(convertWeight("225", "lbsToKg")).toBe(102.06);
    expect(convertWeight("100", "lbsToKg")).toBe(45.36);
  });

  it("converts kilograms to pounds, 2 decimals", () => {
    expect(convertWeight("100", "kgToLbs")).toBe(220.46);
    expect(convertWeight("2.5", "kgToLbs")).toBe(5.51);
  });

  it("treats invalid input as 0", () => {
    expect(convertWeight("abc", "kgToLbs")).toBe(0);
    expect(convertWeight("", "lbsToKg")).toBe(0);
  });
});
