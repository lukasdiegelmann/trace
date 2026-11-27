import { describe, expect, it } from "vitest";

import {
  hoursAndMinutes,
  scheduleDecision,
  startEditError,
  type FastingSchedule,
} from "./fasting";

// A Sunday, 20:30 local
const NOW = new Date(2026, 8, 6, 20, 30);
const schedule: FastingSchedule = {
  isEnabled: true,
  time: "20:00",
  days: [0],
  lastFired: null,
};

describe("scheduleDecision", () => {
  it("starts after the time on a scheduled day", () => {
    expect(scheduleDecision(schedule, false, NOW)).toEqual({
      action: "start",
      day: "2026-09-06",
    });
  });

  it("does nothing when off, fired, early, another day or fasting", () => {
    const cases: [Partial<FastingSchedule>, boolean][] = [
      [{ isEnabled: false }, false],
      [{ lastFired: "2026-09-06" }, false],
      [{ time: "21:00" }, false],
      [{ days: [1] }, false],
      [{}, true],
    ];
    for (const [change, isActive] of cases) {
      expect(
        scheduleDecision({ ...schedule, ...change }, isActive, NOW).action,
      ).toBe("none");
    }
  });

  it("skips a start more than four hours late", () => {
    expect(
      scheduleDecision({ ...schedule, time: "06:00" }, false, NOW).action,
    ).toBe("skip");
  });
});

describe("helpers", () => {
  it("splits a duration", () => {
    expect(hoursAndMinutes((16 * 60 + 5) * 60000 + 59000)).toEqual({
      hours: 16,
      minutes: 5,
    });
  });

  it("validates an edited start", () => {
    expect(startEditError(new Date("x"), NOW)).toBe("invalid");
    expect(startEditError(new Date(2026, 8, 6, 21), NOW)).toBe("future");
    expect(startEditError(new Date(2026, 7, 20), NOW)).toBe("tooOld");
    expect(startEditError(new Date(2026, 8, 6, 8), NOW)).toBeNull();
  });
});
