import { describe, expect, it } from "vitest";

import { goalValueForMetric, isMinimumGoal, resolveRangeGoal } from "./goals";

// Cases from nutritrace/scripts/goal-resolver.test.js (resolveRangeGoal, #203)
describe("resolveRangeGoal", () => {
  it("shared goal returns max", () => {
    expect(resolveRangeGoal({ max: 2000 })).toBe(2000);
    expect(resolveRangeGoal({ sharedGoal: true, max: 2000 })).toBe(2000);
  });

  it("shared falls back to min", () => {
    expect(resolveRangeGoal({ sharedGoal: true, max: null, min: 100 })).toBe(
      100,
    );
  });

  it("per-weekday returns average of non-zero days", () => {
    const g = {
      sharedGoal: false,
      max: 2700,
      days: [2400, 0, 2700, 0, 0, 0, 0],
    };
    expect(resolveRangeGoal(g)).toBe(2550);
  });

  it("per-weekday averages every populated day", () => {
    const g = {
      sharedGoal: false,
      max: 2700,
      days: [2000, 2000, 2000, 2000, 2000, 2500, 2500],
    };
    expect(resolveRangeGoal(g)).toBe(15000 / 7);
  });

  it("per-weekday with all zeros falls back to max", () => {
    expect(
      resolveRangeGoal({
        sharedGoal: false,
        max: 2000,
        days: [0, 0, 0, 0, 0, 0, 0],
      }),
    ).toBe(2000);
  });

  it("per-weekday with no days array falls back to max", () => {
    expect(resolveRangeGoal({ sharedGoal: false, max: 2000 })).toBe(2000);
  });

  it("null / undefined goal returns null", () => {
    expect(resolveRangeGoal(null)).toBeNull();
    expect(resolveRangeGoal(undefined)).toBeNull();
  });
});

describe("goalValueForMetric", () => {
  it("turns a %-of-calories macro goal into grams", () => {
    const goals = {
      calories: { max: 2000 },
      proteins: { max: 30, isPercent: true },
      fat: { max: 30, isPercent: true },
    };
    expect(goalValueForMetric(goals, "proteins", "kcal")).toBe(150);
    expect(goalValueForMetric(goals, "fat", "kcal")).toBe(67);
  });

  it("uses 2000 kcal when no calorie goal is set", () => {
    expect(
      goalValueForMetric(
        { carbohydrates: { max: 50, isPercent: true } },
        "carbohydrates",
        "kcal",
      ),
    ).toBe(250);
  });

  it("converts the calorie goal to kJ", () => {
    expect(
      goalValueForMetric({ calories: { max: 2000 } }, "calories", "kJ"),
    ).toBe(8368);
  });

  it("is null without a goal", () => {
    expect(goalValueForMetric({}, "weight", "kcal")).toBeNull();
  });
});

describe("isMinimumGoal", () => {
  it("is a floor only with min and no max", () => {
    expect(isMinimumGoal({ min: 10000 })).toBe(true);
    expect(isMinimumGoal({ min: 1, max: 2 })).toBe(false);
    expect(isMinimumGoal({ max: 2 })).toBe(false);
    expect(isMinimumGoal(undefined)).toBe(false);
  });
});
