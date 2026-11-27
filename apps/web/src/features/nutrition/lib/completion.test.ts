import { describe, expect, it } from "vitest";

import { areAllMealsMarked, emptyUnmarkedMeals } from "./completion";
import { normalizeDay } from "./diary";

describe("completion", () => {
  const day = normalizeDay(
    {
      items: [{ uuid: "a", meal: 1, addedAt: "", name: "x", nutrition: {} }],
      completed_meals: [2],
    },
    "2026-09-06",
  );

  it("lists empty meals not marked yet", () => {
    expect(emptyUnmarkedMeals(day, 4)).toEqual([0, 3]);
  });

  it("knows when every meal is marked", () => {
    expect(areAllMealsMarked([0, 1], 2)).toBe(true);
    expect(areAllMealsMarked([0], 2)).toBe(false);
    expect(areAllMealsMarked([], 0)).toBe(false);
  });
});
