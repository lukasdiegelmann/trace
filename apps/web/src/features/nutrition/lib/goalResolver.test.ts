/** The cases of nutritrace/scripts/goal-resolver.test.js */
import { describe, expect, it } from "vitest";

import {
  gramsGoalToPercent,
  macroGoalGrams,
  percentGoalToGrams,
  resolveGoalFor,
  resolveRangeGoal,
  type GoalEntry,
} from "./goalResolver";

// 2026-09-06 is a Sunday
const SUN = "2026-09-06";
const TUE = "2026-09-08";

describe("resolveGoalFor", () => {
  it("returns null without a goal", () => {
    expect(resolveGoalFor(null, SUN)).toBeNull();
    expect(resolveGoalFor(undefined, SUN)).toBeNull();
  });

  it("returns max for shared goals, legacy ones included", () => {
    expect(resolveGoalFor({ max: 2000 }, SUN)).toBe(2000);
    expect(resolveGoalFor({ sharedGoal: true, max: 2000 }, SUN)).toBe(2000);
    expect(resolveGoalFor({ sharedGoal: true, max: null, min: 100 }, SUN)).toBe(
      100,
    );
  });

  it("resolves days[weekday] for per-weekday goals", () => {
    const goal = {
      sharedGoal: false,
      max: 2700,
      days: [2400, 0, 2700, 0, 0, 0, 0],
    };
    expect(resolveGoalFor(goal, SUN)).toBe(2400);
    expect(resolveGoalFor(goal, TUE)).toBe(2700);
  });

  it("takes 0 as an explicit target and null as unset", () => {
    expect(
      resolveGoalFor(
        { sharedGoal: false, max: 2000, days: [0, 1, 1, 1, 1, 1, 1] },
        SUN,
      ),
    ).toBe(0);
    expect(
      resolveGoalFor(
        { sharedGoal: false, max: 2000, days: [null, 1, 1, 1, 1, 1, 1] },
        SUN,
      ),
    ).toBe(2000);
  });

  it("falls back to max on malformed days or dates", () => {
    expect(
      resolveGoalFor({ sharedGoal: false, max: 2000, days: [] }, SUN),
    ).toBe(2000);
    expect(
      resolveGoalFor({ sharedGoal: false, max: 2000, days: [2400, 2500] }, SUN),
    ).toBe(2000);
    expect(resolveGoalFor({ sharedGoal: false, max: 2000 }, SUN)).toBe(2000);
    const goal = {
      sharedGoal: false,
      max: 2700,
      days: [2400, 0, 2700, 0, 0, 0, 0],
    };
    expect(resolveGoalFor(goal, null)).toBe(2700);
    expect(resolveGoalFor(goal, "")).toBe(2700);
    expect(resolveGoalFor(goal, "not-a-date")).toBe(2700);
  });

  it("reads the weekday of the local calendar", () => {
    const goal = {
      sharedGoal: false,
      max: 2500,
      days: [1111, 2222, 3333, 4444, 5555, 6666, 7777],
    };
    expect(resolveGoalFor(goal, "2026-09-06")).toBe(1111);
    expect(resolveGoalFor(goal, "2026-09-07")).toBe(2222);
    expect(resolveGoalFor(goal, "2026-09-08")).toBe(3333);
    expect(resolveGoalFor(goal, "2026-09-12")).toBe(7777);
  });

  it("#203: Remaining uses the day's target, not the weekly peak", () => {
    const calories = {
      sharedGoal: false,
      max: 2700,
      days: [2400, 0, 2700, 0, 0, 0, 0],
    };
    expect((resolveGoalFor(calories, SUN) ?? 0) - 2296).toBe(104);
  });
});

describe("resolveRangeGoal", () => {
  it("returns max ?? min for shared goals", () => {
    expect(resolveRangeGoal({ max: 2000 })).toBe(2000);
    expect(resolveRangeGoal({ sharedGoal: true, max: null, min: 100 })).toBe(
      100,
    );
  });

  it("averages the positive weekdays", () => {
    expect(
      resolveRangeGoal({
        sharedGoal: false,
        max: 2700,
        days: [2400, 0, 2700, 0, 0, 0, 0],
      }),
    ).toBe(2550);
    expect(
      resolveRangeGoal({
        sharedGoal: false,
        max: 2700,
        days: [2000, 2000, 2000, 2000, 2000, 2500, 2500],
      }),
    ).toBe(15000 / 7);
  });

  it("falls back to max without positive days", () => {
    expect(
      resolveRangeGoal({
        sharedGoal: false,
        max: 2000,
        days: [0, 0, 0, 0, 0, 0, 0],
      }),
    ).toBe(2000);
    expect(resolveRangeGoal({ sharedGoal: false, max: 2000 })).toBe(2000);
    expect(resolveRangeGoal(null)).toBeNull();
  });
});

describe("percent and grams", () => {
  it("percentGoalToGrams matches the legacy formula", () => {
    const legacy = (cal: number, raw: number, d: number) =>
      Math.round((cal * raw) / 100 / d);
    for (const cal of [1200, 1828, 2000, 2450, 3100]) {
      for (const pct of [0, 5, 12.5, 25, 30, 33.3, 40, 70]) {
        for (const d of [4, 9]) {
          expect(percentGoalToGrams(pct, cal, d)).toBe(legacy(cal, pct, d));
        }
      }
    }
  });

  it("grams to percent and back keeps the grams", () => {
    for (let cal = 800; cal <= 6000; cal += 7) {
      for (const d of [4, 9]) {
        for (let g = 0; g <= 500; g++) {
          const pct = gramsGoalToPercent(g, cal, d);
          if (percentGoalToGrams(pct, cal, d) !== g) {
            throw new Error(`cal=${cal} d=${d} g=${g} pct=${pct}`);
          }
        }
      }
    }
  });

  it("gives clean percentages for the Balanced preset", () => {
    expect(gramsGoalToPercent(137, 1828, 4)).toBe(30);
    expect(gramsGoalToPercent(183, 1828, 4)).toBe(40);
    expect(gramsGoalToPercent(61, 1828, 9)).toBe(30);
    expect(gramsGoalToPercent(percentGoalToGrams(33.3, 1828, 4), 1828, 4)).toBe(
      33.3,
    );
  });

  it("refuses inputs it cannot convert", () => {
    expect(gramsGoalToPercent(137, 0, 4)).toBeNull();
    expect(gramsGoalToPercent(137, NaN, 4)).toBeNull();
    expect(gramsGoalToPercent(NaN, 2000, 4)).toBeNull();
    expect(gramsGoalToPercent(137, 2000, 0)).toBeNull();
    expect(percentGoalToGrams(30, 2000, undefined)).toBeNull();
    expect(percentGoalToGrams("x", 2000, 4)).toBeNull();
  });

  it("macroGoalGrams converts percent goals and leaves the rest alone", () => {
    expect(
      macroGoalGrams({ max: 30, isPercent: true, sharedGoal: true }, 1828, 4),
    ).toBe(137);
    expect(
      macroGoalGrams({ max: 30, isPercent: true, sharedGoal: true }, 1828, 9),
    ).toBe(61);
    expect(
      macroGoalGrams({ min: 25, isMin: true, isPercent: true }, 2000, 4),
    ).toBe(125);
    const before = (goal: GoalEntry | null | undefined) =>
      goal?.max ?? goal?.min ?? null;
    const cases: (GoalEntry | null | undefined)[] = [
      null,
      undefined,
      {},
      { max: 150, sharedGoal: true },
      { max: 150, isPercent: false },
      { min: 120, isMin: true },
      {
        max: 140,
        sharedGoal: false,
        days: [100, 120, 120, 120, 120, 120, 140],
      },
      { max: 0 },
    ];
    for (const goal of cases)
      expect(macroGoalGrams(goal, 1828, 4)).toBe(before(goal));
    expect(macroGoalGrams({ max: 30, isPercent: true }, 1828, undefined)).toBe(
      30,
    );
  });
});
