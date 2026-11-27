import { describe, expect, it } from "vitest";

import {
  matchExercises,
  mergeIntoWorkout,
  readParsedExercises,
  scoreMatch,
} from "./smartLog";

const library = [
  { id: 1, name: "Barbell Bench Press" },
  { id: 2, name: "Bench Press" },
  { id: 3, name: "Overhead Press" },
  { id: 4, name: "Plank" },
];

const parsed = (exercises: unknown[]) =>
  readParsedExercises({ exercises }) ?? [];

describe("smart log", () => {
  it("reads the model's JSON, strings and gaps included", () => {
    expect(readParsedExercises(null)).toBeNull();
    expect(readParsedExercises({ sets: [] })).toBeNull();
    expect(
      parsed([
        { name: " bench ", sets: [{ reps: "5", weight: "100", rpe: null }] },
        { sets: [] },
      ]),
    ).toEqual([
      {
        name: "bench",
        sets: [{ reps: 5, weight: 100 }],
        supersetGroup: null,
        notes: null,
      },
    ]);
  });

  it("scores exact, prefix, substring and shared words", () => {
    expect(scoreMatch("bench press", "Bench Press")).toBe(100);
    expect(scoreMatch("bench", "Bench Press")).toBe(85);
    expect(scoreMatch("press", "Bench Press")).toBe(70);
    expect(scoreMatch("incline press", "Bench Press")).toBe(25);
    expect(scoreMatch("squat", "Bench Press")).toBe(0);
  });

  it("matches by name and alias, best first", () => {
    const [bench, ohp, unknown] = matchExercises(
      parsed([{ name: "bench press" }, { name: "OHP" }, { name: "yoke" }]),
      library,
    );
    expect(bench.best?.id).toBe(2);
    expect(bench.candidates.map((c) => c.exercise.id)).toEqual([2, 1]);
    expect(ohp.best?.id).toBe(3);
    expect(unknown.best).toBeNull();
  });

  it("appends to the workout with supersets after the existing ones", () => {
    const merged = mergeIntoWorkout(
      matchExercises(
        parsed([
          { name: "bench press", superset_group: "A", sets: [{ reps: 5 }] },
          { name: "yoke", superset_group: "A", sets: [] },
          { name: "plank", sets: [{ duration_sec: 45 }] },
        ]),
        library,
      ),
      [{ exercise_name: "Squat", superset_id: 4 }],
    );
    expect(merged).toHaveLength(4);
    expect(merged[1]).toMatchObject({
      exercise_id: 2,
      superset_id: 5,
      superset_size: 2,
      target_reps: 5,
      sets: [{ reps: 5, completed: false }],
    });
    expect(merged[2]).toMatchObject({
      exercise_id: null,
      exercise_name: "yoke",
      superset_id: 5,
    });
    expect(merged[3]).toMatchObject({
      set_type: "time",
      target_reps: null,
      target_duration: "45",
    });
  });

  it("drops a superset of one", () => {
    const [only] = mergeIntoWorkout(
      matchExercises(parsed([{ name: "plank", superset_group: "A" }]), library),
      [],
    );
    expect(only.superset_id).toBeFalsy();
  });
});
