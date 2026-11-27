import { describe, expect, it } from "vitest";

import {
  effectiveDuration,
  fmtSummaryDuration,
  fmtVolume,
  groupCompletedExercises,
  summaryStats,
} from "./workoutSummary";

describe("workout summary", () => {
  it("prefers the saved duration over the timer", () => {
    expect(effectiveDuration(45, 12)).toBe(45);
    expect(effectiveDuration(0, 12.34)).toBe(12.3);
    expect(effectiveDuration(null, null)).toBe(0);
  });

  it("formats duration and volume", () => {
    expect(fmtSummaryDuration(65)).toBe("1h 5m");
    expect(fmtSummaryDuration(45)).toBe("45m");
    expect(fmtSummaryDuration(0)).toBe("—");
    expect(fmtVolume(12345)).toBe("12.3k");
    expect(fmtVolume(999.6)).toBe("1000");
  });

  const exercises = [
    {
      superset_id: "a",
      sets: [{ weight: 10, reps: 10, completed: true }],
    },
    { superset_id: "a", sets: [{ completed: true, warmup: true }] },
    { sets: [{ completed: false }] },
    { sets: [{ weight: 50, reps: 2, completed: true }] },
  ];

  it("counts working sets, volume and exercises", () => {
    expect(summaryStats({ exercises })).toEqual({
      volume: 200,
      sets: 2,
      exercises: 2,
    });
  });

  it("groups completed supersets", () => {
    expect(groupCompletedExercises(exercises).map((g) => g.kind)).toEqual([
      "superset",
      "single",
    ]);
  });
});
