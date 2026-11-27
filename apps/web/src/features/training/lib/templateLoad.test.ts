import { describe, expect, it } from "vitest";

import {
  copiedExercises,
  insertExercise,
  newDiaryExercise,
  progressionSuggestion,
  quickLoadExercise,
  resolveWeek,
  suggestedWorkoutName,
  templateExerciseToLog,
  templateTarget,
  volumeDeltaPct,
  withAutoWarmups,
} from "./templateLoad";

const last = [
  { weight: 45, reps: 8, warmup: true, completed: true },
  { weight: 100, reps: 10, completed: true },
  { weight: 100, reps: 8, completed: true },
];

describe("weeks (issue #13)", () => {
  const exercise = {
    target_sets: 3,
    target_reps: "8",
    target_weight: "100",
    rest_sec: 90,
    weeks: [null, { weight: "105", sets: 4 }],
  };

  it("merges the week over the flat targets", () => {
    expect(resolveWeek(exercise, 2)).toMatchObject({
      sets: 4,
      reps: "8",
      weight: "105",
      rest_sec: 90,
    });
    expect(resolveWeek(exercise, 1).weight).toBe("100");
    expect(resolveWeek(exercise, 5).weight).toBe("100");
    expect(resolveWeek(exercise, null).sets).toBe(3);
  });

  it("the plan week wins over last session, else history wins", () => {
    const planned = templateExerciseToLog(exercise, last, 2);
    expect(planned.sets?.map((s) => s.weight)).toEqual([105, 105, 105, 105]);
    const remembered = templateExerciseToLog(exercise, last, null);
    expect(remembered.sets?.map((s) => [s.weight, s.reps])).toEqual([
      [100, 10],
      [100, 8],
      [100, 8],
    ]);
    expect(templateExerciseToLog(exercise, null, null).sets?.[0]).toMatchObject(
      {
        weight: 100,
        reps: 8,
        completed: false,
      },
    );
  });
});

describe("per-set specs (issue #103)", () => {
  it("fills warm-up rows from warm-ups and working rows from working sets", () => {
    const out = templateExerciseToLog(
      {
        set_specs: [
          { warmup: true },
          { reps: "5" },
          { weight: "120", number: 3, rpe: 8, reps_l: "4", reps_r: "5" },
        ],
      },
      last,
      null,
    );
    expect(out.sets?.[0]).toMatchObject({ warmup: true, weight: 45, reps: 8 });
    expect(out.sets?.[1]).toMatchObject({ weight: 100, reps: 5 });
    expect(out.sets?.[2]).toMatchObject({
      weight: 120,
      reps: 8,
      number: 3,
      rpe: 8,
      reps_l: 4,
      reps_r: 5,
    });
  });

  it("fills durations for timed exercises", () => {
    const planned = templateExerciseToLog(
      { set_type: "time", target_sets: 2, target_duration: "1:00" },
      null,
      null,
    );
    expect(planned.sets?.map((s) => s.duration_sec)).toEqual([60, 60]);
    const spec = templateExerciseToLog(
      { set_type: "time", set_specs: [{ duration: "130" }] },
      null,
      null,
    );
    expect(spec.sets?.[0].duration_sec).toBe(90);
  });
});

describe("auto warm-ups", () => {
  it("prepends the ramp, never for holds", () => {
    const [lift, hold] = withAutoWarmups(
      [
        { sets: [{ weight: 100, reps: 5 }] },
        { set_type: "time", sets: [{ weight: 100, duration_sec: 30 }] },
      ],
      "kg",
    );
    expect(lift.sets?.filter((s) => s.warmup)).toHaveLength(4);
    expect(hold.sets).toHaveLength(1);
  });
});

describe("quick load and copy", () => {
  it("keeps warm-up shape and fills from the last session", () => {
    const out = quickLoadExercise(
      {
        sets: [
          { warmup: true, weight: 40, reps: 8 },
          { weight: 90 },
          { weight: 90 },
        ],
      },
      [{ weight: 100, reps: 10 }],
    );
    expect(out.sets?.map((s) => [s.weight, s.reps, !!s.warmup])).toEqual([
      [40, 8, true],
      [100, 10, false],
      [100, 10, false],
    ]);
  });

  it("clears without history and keeps timed exercises timed", () => {
    const out = quickLoadExercise(
      { sets: [{ duration_sec: 30, weight: 10 }] },
      null,
    );
    expect(out.set_type).toBe("time");
    expect(out.sets).toEqual([
      { weight: 0, reps: 0, completed: false, notes: "" },
    ]);
  });

  it("copies yesterday open, reps cleared", () => {
    expect(
      copiedExercises([{ sets: [{ weight: 80, reps: 5, completed: true }] }])[0]
        ?.sets?.[0],
    ).toMatchObject({ weight: 80, reps: 0, completed: false });
  });
});

describe("adding from the library", () => {
  const picked = { id: 3, name: "Bench Press" };

  it("repeats the last session with its warm-ups", () => {
    const out = newDiaryExercise(picked, last, { 3: "paired" }, {});
    expect(out).toMatchObject({
      exercise_id: 3,
      target_sets: 2,
      target_reps: "10",
      target_weight: "100",
      load_type: "paired",
    });
    expect(out.sets?.[0].warmup).toBe(true);
    expect(out.set_type).toBeUndefined();
  });

  it("starts with one empty set and 3×10 targets", () => {
    expect(newDiaryExercise(picked, null, {}, {})).toMatchObject({
      sets: [{ reps: 0, weight: 0, completed: false }],
      target_sets: 3,
      target_reps: "10",
    });
  });

  it("decides timed from data, library, memory and name", () => {
    const timed = (
      name: string,
      lastSets: object[] | null,
      setType?: "reps" | "time",
      remembered?: "reps" | "time",
    ) =>
      newDiaryExercise(
        { id: 1, name, set_type: setType },
        lastSets,
        {},
        { 1: remembered },
      ).set_type === "time";
    expect(timed("Plank", null)).toBe(true);
    expect(timed("Plank", null, "reps")).toBe(false);
    expect(timed("Plank", null, undefined, "reps")).toBe(false);
    expect(timed("Squat", null, undefined, "time")).toBe(true);
    expect(timed("Squat", [{ duration_sec: 20 }], "reps")).toBe(true);
    expect(timed("Plank", [{ reps: 10 }])).toBe(false);
  });

  it("inserts behind a superset", () => {
    const list = [{ superset_id: "a" }, { exercise_name: "x" }];
    expect(
      insertExercise(list, { exercise_name: "new" }, "a")[1],
    ).toMatchObject({ exercise_name: "new", superset_id: "a" });
  });
});

describe("names, nudges and targets", () => {
  const cats = (...c: string[]) => c.map((category) => ({ category }));

  it("suggests a workout name from categories", () => {
    expect(suggestedWorkoutName(cats("chest", "shoulders"))?.kind).toBe("push");
    expect(suggestedWorkoutName(cats("back", "biceps"))?.kind).toBe("pull");
    expect(suggestedWorkoutName(cats("legs"))?.kind).toBe("legs");
    expect(suggestedWorkoutName(cats("arms"))?.kind).toBe("arms");
    expect(suggestedWorkoutName(cats("chest", "back"))?.kind).toBe("upper");
    expect(suggestedWorkoutName(cats("a", "b", "c", "d"))?.kind).toBe("full");
    expect(suggestedWorkoutName(cats("core"))).toEqual({
      kind: "category",
      category: "Core",
    });
    expect(suggestedWorkoutName([{}])?.kind).toBe("workout");
    expect(suggestedWorkoutName([])).toBeNull();
  });

  it("nudges one plate step when every set hit the target", () => {
    const completed = [
      { weight: 100, reps: 8 },
      { weight: 100, reps: 9 },
    ];
    expect(
      progressionSuggestion(
        { target_reps: "8-12" },
        { completed },
        "kg",
        false,
      ),
    ).toEqual({ weight: 102.5, step: 2.5 });
    expect(
      progressionSuggestion({ target_reps: "9" }, { completed }, "kg", false),
    ).toBeNull();
    expect(
      progressionSuggestion({ target_reps: "8" }, { completed }, "lbs", true),
    ).toBeNull();
  });

  it("compares volume in percent", () => {
    expect(volumeDeltaPct(720, 1000)).toBe(-28);
    expect(volumeDeltaPct(0, 1000)).toBeNull();
  });

  it("describes template targets", () => {
    const reps = (r: string) => `${r} reps`;
    expect(
      templateTarget(
        { target_sets: 3, target_reps: "8", target_weight: "100" },
        "kg",
        reps,
      ),
    ).toBe("3×8 @ 100kg");
    expect(
      templateTarget(
        { set_specs: [{ reps: "5", weight: "100" }, { reps: "3" }] },
        "kg",
        reps,
      ),
    ).toBe("5×100kg, 3 reps");
    expect(
      templateTarget(
        { set_type: "time", target_sets: 3, target_duration: "1:00" },
        "kg",
        reps,
      ),
    ).toBe("3×1:00");
  });
});
