/** Cases after goals-percent-mode.test.js and goals-macro-preset.test.js */
import { describe, expect, it } from "vitest";

import type { Goals } from "../api";
import {
  applyMacroPreset,
  currentPreset,
  goalEntryOf,
  goalFormOf,
  goalWarnings,
  macroShares,
  macroTargets,
  migrateKilojoulesGoal,
  nutrientGoalIds,
  removeGoal,
  rowTarget,
  saveGoal,
  templateGoalCount,
  togglePercent,
} from "./goals";

const SUNDAY = "2026-09-06";

describe("kilojoules", () => {
  it("migrates an old kJ goal into kcal", () => {
    const migrated = migrateKilojoulesGoal({
      kilojoules: { max: 8368, days: [4184, null] },
    });
    expect(migrated.kilojoules).toBeUndefined();
    expect(migrated.calories?.max).toBeCloseTo(2000);
    expect(migrated.calories?.days).toEqual([1000, null]);
    expect(migrated.calories).not.toHaveProperty("min");
  });

  it("keeps an existing calorie goal and drops empty kJ ones", () => {
    expect(
      migrateKilojoulesGoal({ calories: { max: 1 }, kilojoules: { max: 9 } }),
    ).toEqual({ calories: { max: 1 } });
    expect(migrateKilojoulesGoal({ kilojoules: { max: null } })).toEqual({});
    const same: Goals = { fat: { max: 1 } };
    expect(migrateKilojoulesGoal(same)).toBe(same);
  });

  it("stores kJ input as kcal and removes it from the kJ row", () => {
    const form = {
      ...goalFormOf(undefined, "kilojoules", "kJ"),
      value: "8368",
    };
    const goals = saveGoal(
      {},
      "kilojoules",
      goalEntryOf(form, "kilojoules", "kJ"),
    );
    expect(goals.calories?.max).toBeCloseTo(2000);
    expect(rowTarget(goals, "kilojoules", SUNDAY, 2000, "kJ")).toBe(8368);
    expect(removeGoal(goals, "kilojoules")).toEqual({});
    expect(nutrientGoalIds("kJ")).not.toContain("calories");
    expect(nutrientGoalIds("kcal")).not.toContain("kilojoules");
  });
});

describe("goal editor", () => {
  it("starts every field from the goal opened", () => {
    expect(goalFormOf({ max: 70 }, "fat", "kcal").days).toEqual(
      Array(7).fill("70"),
    );
    expect(goalFormOf(undefined, "fat", "kcal")).toMatchObject({
      isShared: true,
      isShownInDiary: true,
      value: "",
    });
  });

  it("allows a target of 0 and treats empty as not set", () => {
    const form = goalFormOf(undefined, "alcohol", "kcal");
    expect(goalEntryOf({ ...form, value: "0" }, "alcohol", "kcal").max).toBe(0);
    expect(goalEntryOf(form, "alcohol", "kcal").max).toBeNull();
  });

  it("keeps the weekly peak beside per-weekday targets", () => {
    const form = {
      ...goalFormOf(undefined, "calories", "kcal"),
      isShared: false,
      isMin: true,
      days: ["2400", "", "2,7", "", "", "", ""],
    };
    const entry = goalEntryOf(form, "calories", "kcal");
    expect(entry.min).toBe(2400);
    expect(entry).not.toHaveProperty("max");
    expect(entry.days?.slice(0, 3)).toEqual([2400, null, 2.7]);
  });

  it("converts typed values when percent is toggled", () => {
    const form = {
      ...goalFormOf(undefined, "proteins", "kcal"),
      value: "137",
      days: ["137", "", "150", "abc", "", "", "120,5"],
    };
    const percent = togglePercent(form, true, "proteins", 1828);
    expect(percent.value).toBe("30");
    expect(percent.days[1]).toBe("");
    expect(percent.days[3]).toBe("abc");
    expect(togglePercent(percent, false, "proteins", 1828).value).toBe("137");
    expect(togglePercent(form, true, "fiber", 1828).value).toBe("137");
  });
});

describe("targets and presets", () => {
  const goals: Goals = {
    calories: {
      sharedGoal: false,
      max: 2700,
      days: [1828, 0, 2700, 0, 0, 0, 0],
    },
    proteins: { max: 30, isPercent: true, showInDiary: false },
    carbohydrates: { max: 183 },
    fat: { min: 61, isMin: true },
  };

  it("resolves a day's targets, percent on that day's calories", () => {
    expect(rowTarget(goals, "calories", SUNDAY, 1828, "kcal")).toBe(1828);
    expect(macroTargets(goals, SUNDAY, 1828)).toEqual({
      protein: 137,
      carbs: 183,
      fat: 61,
    });
    expect(currentPreset(macroShares(macroTargets(goals, SUNDAY, 1828)))).toBe(
      "balanced",
    );
  });

  it("applies a preset as one maximum, keeping display switches", () => {
    const next = applyMacroPreset(goals, "keto", 2000);
    expect(next.fat).toMatchObject({
      max: 156,
      isMin: false,
      sharedGoal: true,
    });
    expect(next.fat).not.toHaveProperty("min");
    expect(next.proteins).toMatchObject({
      max: 125,
      isPercent: false,
      showInDiary: false,
    });
    expect(next.carbohydrates?.days).toEqual(Array(7).fill(25));
  });

  it("recognises presets within two points", () => {
    expect(currentPreset({ protein: 31, carbs: 38, fat: 31 })).toBe("balanced");
    expect(currentPreset({ protein: 35, carbs: 35, fat: 30 })).toBe("custom");
    expect(currentPreset({ protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });

  it("warns about extreme and inconsistent targets", () => {
    expect(goalWarnings(1000, 0).map((w) => w.kind)).toEqual([
      "tooLow",
      "noMacros",
    ]);
    expect(goalWarnings(6000, 6000).map((w) => w.kind)).toEqual(["tooHigh"]);
    expect(goalWarnings(2000, 2200)).toEqual([
      { kind: "mismatch", macroKcal: 2200 },
    ]);
    expect(goalWarnings(2000, 2090)).toEqual([]);
  });

  it("counts a template's targets", () => {
    expect(templateGoalCount({ a: { max: 1 }, b: { max: null } }, 2000)).toBe(
      2,
    );
    expect(templateGoalCount({}, 0)).toBe(0);
  });
});
