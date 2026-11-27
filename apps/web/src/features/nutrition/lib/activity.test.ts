import { describe, expect, it } from "vitest";

import type { ActivityRow } from "../api";
import {
  ACTIVITIES,
  activityHistory,
  groupedByCategory,
  metKcal,
  newerWeight,
  searchCompendium,
} from "./activity";

describe("compendium", () => {
  it("groups every activity into a known category", () => {
    const grouped = groupedByCategory().flatMap((g) => g.activities);
    expect(grouped).toHaveLength(ACTIVITIES.length);
  });

  it("ranks names that start with the query first", () => {
    const results = searchCompendium("walk");
    expect(results[0].name.toLowerCase().startsWith("walk")).toBe(true);
    expect(searchCompendium("  ")).toEqual([]);
  });

  it("estimates kcal from MET, weight and minutes", () => {
    expect(metKcal({ met: 3.5, weightKg: 80, durationMin: 30 })).toBe(140);
    expect(metKcal({ met: null, weightKg: 80, durationMin: 30 })).toBeNull();
    expect(metKcal({ met: 3, weightKg: 80, durationMin: "" })).toBeNull();
  });
});

describe("history", () => {
  const row = (id: number, name: string, date: string, isTemplate = 0) =>
    ({ id, name, date, is_template: isTemplate }) as ActivityRow;

  it("keeps the newest of each name", () => {
    const { past, templates } = activityHistory([
      row(1, "Run", "2026-01-01", 1),
      row(2, "run", "2026-02-01"),
      row(3, "Swim", "2026-01-15"),
    ]);
    expect(past.map((r) => r.id)).toEqual([2, 3]);
    expect(templates.map((r) => r.id)).toEqual([1]);
  });

  it("takes the newer weight, the diary on a tie", () => {
    const diary = { kg: 80, date: "2026-01-02" };
    const scale = { kg: 81, date: "2026-01-03" };
    expect(newerWeight(diary, scale)).toBe(scale);
    expect(newerWeight(diary, { ...scale, date: "2026-01-02" })).toBe(diary);
    expect(newerWeight(null, scale)).toBe(scale);
  });
});
