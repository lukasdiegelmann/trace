import { describe, expect, it } from "vitest";

import {
  celebrationFor,
  countPrs,
  didCompleteWorkingSet,
  isWorkoutDone,
  justCompletedSet,
  previousBest,
  prFlags,
} from "./prs";

const TODAY = "2026-11-26";
const history = [
  { date: TODAY, sets: [{ weight: 200, reps: 5, completed: true }] },
  {
    date: "2026-11-20",
    sets: [
      { weight: 300, reps: 1, completed: true, warmup: true },
      { weight: 100, reps: 5, completed: true },
      { weight: 90, reps: 12, completed: true },
    ],
  },
];

describe("personal records", () => {
  it("takes the best from other days only, without warm-ups", () => {
    expect(previousBest(history, TODAY)).toMatchObject({
      topWeight: 100,
      topE1rm: 90 * (1 + 12 / 30),
    });
  });

  it("flags sets beating weight or e1RM", () => {
    const flags = prFlags(
      [
        {
          exercise_id: 1,
          sets: [
            { weight: 101, reps: 1, completed: true },
            { weight: 100, reps: 5, completed: true },
            { weight: 95, reps: 12, completed: true },
            { weight: 120, reps: 5, completed: false },
          ],
        },
      ],
      { 1: previousBest(history, TODAY) },
    );
    expect([...(flags.get(0) ?? [])]).toEqual([0, 2]);
    expect(countPrs(flags)).toBe(2);
  });

  it("celebrates only with a baseline", () => {
    const set = { weight: 110, reps: 5, completed: true };
    expect(celebrationFor({}, set, history, TODAY)).toMatchObject({
      kind: "weight",
    });
    expect(
      celebrationFor({}, { weight: 100, reps: 15 }, history, TODAY),
    ).toMatchObject({ kind: "e1rm" });
    expect(celebrationFor({}, set, [], TODAY)).toBeNull();
    expect(
      celebrationFor({}, { ...set, warmup: true }, history, TODAY),
    ).toBeNull();
  });

  it("keeps holds and lifts apart", () => {
    const holds = [
      {
        date: "2026-11-01",
        set_type: "time" as const,
        sets: [{ duration_sec: 60, weight: 10, completed: true }],
      },
    ];
    expect(
      celebrationFor({}, { duration_sec: 75 }, holds, TODAY),
    ).toMatchObject({ kind: "hold", durationSec: 75 });
    expect(
      celebrationFor({}, { duration_sec: 30, weight: 20 }, holds, TODAY),
    ).toMatchObject({ kind: "hold" });
    expect(
      celebrationFor({}, { weight: 50, reps: 5 }, holds, TODAY),
    ).toBeNull();
  });

  it("detects completion", () => {
    const before = { sets: [{ completed: false }] };
    const after = { sets: [{ completed: true }] };
    expect(didCompleteWorkingSet(before, after)).toBe(true);
    expect(justCompletedSet(before, after)).toEqual({ completed: true });
    expect(isWorkoutDone([after])).toBe(true);
    expect(isWorkoutDone([after, before])).toBe(false);
    expect(isWorkoutDone([{ sets: [] }])).toBe(false);
    expect(isWorkoutDone([])).toBe(false);
  });
});
