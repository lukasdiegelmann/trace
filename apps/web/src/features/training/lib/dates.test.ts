import { describe, expect, it } from "vitest";

import { getCollapseState, setCollapsed } from "./cardCollapse";
import {
  addDays,
  dayOffset,
  isValidDate,
  monthGrid,
  relativeTime,
  streakCount,
  weekPeek,
} from "./dates";

const TODAY = "2026-11-26";

describe("diary dates", () => {
  it("walks days across months", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(dayOffset("2026-11-25", TODAY)).toBe(-1);
    expect(isValidDate("2026-11-26")).toBe(true);
    expect(isValidDate("today")).toBe(false);
  });

  it("counts the streak with a morning's grace", () => {
    const days = new Set(["2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(streakCount(days, TODAY)).toBe(3);
    expect(streakCount(new Set([...days, TODAY]), TODAY)).toBe(4);
    expect(streakCount(new Set(["2026-11-24"]), TODAY)).toBe(0);
    expect(streakCount(new Set(), TODAY)).toBe(0);
  });

  it("peeks at the last seven days", () => {
    const week = weekPeek(new Set([TODAY]), TODAY);
    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe("2026-11-20");
    expect(week[6]).toEqual({ date: TODAY, isDone: true, isToday: true });
  });

  it("lays out a month from Monday", () => {
    // 1 November 2026 is a Sunday
    const grid = monthGrid(2026, 10);
    expect(grid.slice(0, 7)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      "2026-11-01",
    ]);
    expect(grid).toHaveLength(36);
  });

  it("reads server and ISO times relative to now", () => {
    const now = Date.parse("2026-11-26T12:00:00Z");
    expect(relativeTime("2026-11-26 11:59:40", now)?.unit).toBe("now");
    expect(relativeTime("2026-11-26T11:30:00Z", now)).toEqual({
      unit: "minute",
      value: 30,
    });
    expect(relativeTime("2026-11-24 12:00:00", now)).toEqual({
      unit: "day",
      value: 2,
    });
    expect(relativeTime("2026-11-01 12:00:00", now)?.unit).toBe("date");
    expect(relativeTime(null, now)).toBeNull();
  });
});

describe("card collapse", () => {
  it("keeps three states and the last 30 days", () => {
    expect(getCollapseState(TODAY, "a")).toBeNull();
    setCollapsed(TODAY, "a", true);
    expect(getCollapseState(TODAY, "a")).toBe("collapsed");
    setCollapsed(TODAY, "a", false);
    expect(getCollapseState(TODAY, "a")).toBe("expanded");
    for (let i = 1; i <= 30; i++) setCollapsed(addDays(TODAY, i), "a", true);
    expect(getCollapseState(TODAY, "a")).toBeNull();
  });
});
