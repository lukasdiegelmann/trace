import { describe, expect, it } from "vitest";

import type { AdaptiveTdee } from "../api";
import { calorieGoal, nutrientBars, percentOf, targetFor } from "./dayGoals";

const DATE = "2026-09-06";
const base = {
  goals: { calories: { sharedGoal: true, max: 1800 } },
  date: DATE,
  factor: 0.8,
  caloriesOut: null,
  adaptive: null,
};

describe("calorieGoal", () => {
  it("uses the day's fixed goal, else 2000", () => {
    expect(calorieGoal({ ...base, mode: "fixed" })).toEqual({
      kcal: 1800,
      source: "fixed",
    });
    expect(calorieGoal({ ...base, goals: {}, mode: "fixed" }).kcal).toBe(2000);
  });

  it("scales burn and TDEE by the factor, falling back to fixed", () => {
    expect(
      calorieGoal({ ...base, mode: "dynamic", caloriesOut: 2500 }),
    ).toEqual({ kcal: 2000, source: "dynamic" });
    expect(calorieGoal({ ...base, mode: "dynamic" }).source).toBe("fixed");
    const adaptive = { ready: true, tdee: 3000 } as AdaptiveTdee;
    expect(calorieGoal({ ...base, mode: "adaptive", adaptive }).kcal).toBe(
      2400,
    );
    expect(
      calorieGoal({
        ...base,
        mode: "adaptive",
        adaptive: { ...adaptive, ready: false },
      }).source,
    ).toBe("fixed");
  });
});

describe("targets", () => {
  const goals = {
    calories: { max: 2000 },
    proteins: { max: 30, isPercent: true },
    fiber: { min: 30, isMin: true },
    sugars: { max: 50, showInDiary: false },
  };

  it("converts percent macros on the day's calorie goal", () => {
    expect(targetFor(goals, "proteins", DATE, 2400)).toBe(180);
    expect(targetFor(goals, "fat", DATE, 2400)).toBeNull();
  });

  it("builds the bars: goals shown in the diary, minimums never over", () => {
    const bars = nutrientBars(
      goals,
      { calories: 2500, proteins: 100, fiber: 40, sugars: 90 },
      DATE,
      2000,
      "kcal",
    );
    expect(bars.map((b) => [b.id, b.isOver])).toEqual([
      ["calories", true],
      ["fiber", false],
      ["proteins", false],
    ]);
  });

  it("guards a zero goal", () => {
    expect(percentOf(500, 0)).toBe(0);
    expect(percentOf(500, null)).toBe(0);
    expect(percentOf(3000, 2000)).toBe(100);
  });
});
