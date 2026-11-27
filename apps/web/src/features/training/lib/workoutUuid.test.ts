import { describe, expect, it } from "vitest";

import {
  diffTombstones,
  ensureExerciseUuids,
  withFreshIds,
} from "./workoutUuid";

describe("uuids (readd-after-clear.test.js, issue #99)", () => {
  const source = [
    { uuid: "a", exercise_name: "Bench", sets: [{ uuid: "x", reps: 5 }] },
  ];

  it("keeps ids that exist and returns the same array", () => {
    expect(ensureExerciseUuids(source)).toBe(source);
  });

  it("stamps missing ids once", () => {
    const [out] = ensureExerciseUuids([{ sets: [{}] }]);
    expect(out.uuid).toBeTruthy();
    expect(out.sets?.[0].uuid).toBeTruthy();
  });

  it("copies get fresh ids and nothing else changes", () => {
    const [out] = withFreshIds(source);
    expect(out.uuid).not.toBe("a");
    expect(out.sets?.[0].uuid).not.toBe("x");
    expect(out.exercise_name).toBe("Bench");
    expect(out.sets?.[0].reps).toBe(5);
    expect(source[0].uuid).toBe("a");
    expect(withFreshIds(source)[0].uuid).not.toBe(out.uuid);
  });

  it("tombstones removed exercises and removed sets", () => {
    const snapshot = [
      { uuid: "a", sets: [{ uuid: "1" }, { uuid: "2" }] },
      { uuid: "b", sets: [{ uuid: "3" }] },
    ];
    expect(
      diffTombstones(snapshot, [{ uuid: "a", sets: [{ uuid: "2" }] }]),
    ).toEqual({ exercises: ["b"], sets: { a: ["1"] } });
  });
});
