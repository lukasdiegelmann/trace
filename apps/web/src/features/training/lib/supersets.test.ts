import { describe, expect, it } from "vitest";

import {
  createSuperset,
  currentStatus,
  existingSupersets,
  groupExercises,
  joinSuperset,
  leaveSuperset,
  moveExercise,
  moveWithinSuperset,
  nextAfterRest,
  removeSuperset,
  shouldStartRest,
  updateSetInList,
  workingSetNumber,
} from "./supersets";
import type { WorkoutExercise, WorkoutSet } from "./workoutTypes";

const single = (name: string): WorkoutExercise => ({
  exercise_name: name,
  sets: [{ completed: false }],
});
const member = (name: string, id = "ss1", position = 0): WorkoutExercise => ({
  ...single(name),
  superset_id: id,
  superset_size: 2,
  superset_position: position,
});
const names = (list: WorkoutExercise[]) => list.map((e) => e.exercise_name);

/** The day of scripts/exercise-reorder.test.js */
const day = () => [
  single("Deadlifts"),
  member("KB Swings"),
  member("Battle Ropes", "ss1", 1),
  single("Sumo Squats"),
  single("Leg Press"),
];

describe("block reordering (exercise-reorder.test.js)", () => {
  it("groups a superset as one block", () => {
    const groups = groupExercises(day());
    expect(groups).toHaveLength(4);
    expect(names(groups[1]?.exercises ?? [])).toEqual([
      "KB Swings",
      "Battle Ropes",
    ]);
  });

  it("an exercise below a superset moves in front of the whole superset", () => {
    expect(names(moveExercise(day(), 3, -1))).toEqual([
      "Deadlifts",
      "Sumo Squats",
      "KB Swings",
      "Battle Ropes",
      "Leg Press",
    ]);
  });

  it("a superset moves as one block", () => {
    expect(names(moveExercise(day(), 2, 1))).toEqual([
      "Deadlifts",
      "Sumo Squats",
      "KB Swings",
      "Battle Ropes",
      "Leg Press",
    ]);
  });

  it("two single exercises swap", () => {
    expect(names(moveExercise(day(), 4, -1))).toEqual([
      "Deadlifts",
      "KB Swings",
      "Battle Ropes",
      "Leg Press",
      "Sumo Squats",
    ]);
  });

  it("the ends of the list hold", () => {
    expect(names(moveExercise(day(), 0, -1))).toEqual(names(day()));
    expect(names(moveExercise(day(), 4, 1))).toEqual(names(day()));
  });

  it("never separates a superset", () => {
    for (let i = 0; i < day().length; i++) {
      for (const direction of [-1, 1] as const) {
        const groups = groupExercises(moveExercise(day(), i, direction));
        expect(
          groups.find((g) => g.type === "superset")?.exercises,
        ).toHaveLength(2);
      }
    }
  });

  it("swaps members inside a superset", () => {
    expect(names(moveWithinSuperset(day(), "ss1", 0, 1)).slice(1, 3)).toEqual([
      "Battle Ropes",
      "KB Swings",
    ]);
  });
});

describe("superset membership", () => {
  it("creates a superset at the first picked place, in list order", () => {
    const out = createSuperset(day(), [4, 0], "new");
    expect(names(out).slice(0, 2)).toEqual(["Deadlifts", "Leg Press"]);
    expect(out[0]).toMatchObject({
      superset_id: "new",
      superset_size: 2,
      superset_position: 0,
    });
    expect(out[1]?.superset_position).toBe(1);
  });

  it("joins behind the last member and recounts", () => {
    const out = joinSuperset(day(), 4, "ss1");
    expect(names(out)).toEqual([
      "Deadlifts",
      "KB Swings",
      "Battle Ropes",
      "Leg Press",
      "Sumo Squats",
    ]);
    expect(out[3]).toMatchObject({ superset_size: 3, superset_position: 2 });
  });

  it("leaving from the middle moves behind the block", () => {
    const three = joinSuperset(day(), 4, "ss1");
    const out = leaveSuperset(three, 2);
    expect(names(out)).toEqual([
      "Deadlifts",
      "KB Swings",
      "Leg Press",
      "Battle Ropes",
      "Sumo Squats",
    ]);
    expect(out[3]?.superset_id).toBeUndefined();
    expect(groupExercises(out)[1]?.exercises).toHaveLength(2);
  });

  it("dissolves a pair when one leaves", () => {
    const out = leaveSuperset(day(), 1);
    expect(out.every((e) => e.superset_id === undefined)).toBe(true);
  });

  it("lists and removes supersets", () => {
    expect(existingSupersets(day())).toEqual([
      { id: "ss1", names: ["KB Swings", "Battle Ropes"] },
    ]);
    expect(names(removeSuperset(day(), "ss1"))).toEqual([
      "Deadlifts",
      "Sumo Squats",
      "Leg Press",
    ]);
  });
});

describe("rest after a round", () => {
  const set = (isDone: boolean, extra: WorkoutSet = {}) => ({
    completed: isDone,
    ...extra,
  });
  const pair = (a: WorkoutSet[], b: WorkoutSet[]) => [
    { ...member("A"), sets: a },
    { ...member("B", "ss1", 1), sets: b },
  ];

  it("a single exercise always rests", () => {
    const list = [single("A")];
    expect(shouldStartRest(list, 0, list[0])).toBe(true);
  });

  it("a superset waits until every member finished the round", () => {
    const list = pair([set(false), set(false)], [set(false), set(false)]);
    const afterA = { ...list[0], sets: [set(true), set(false)] };
    expect(shouldStartRest(list, 0, afterA)).toBe(false);
    const withA = [afterA, list[1] as WorkoutExercise];
    const afterB = { ...list[1], sets: [set(true), set(false)] };
    expect(shouldStartRest(withA, 1, afterB)).toBe(true);
    expect(nextAfterRest(withA, 1, afterB).exercise_name).toBe("A");
  });

  it("members without a set of the round are skipped (add-on sets)", () => {
    const list = pair([set(true), set(false)], [set(false, { number: 3 })]);
    const after = { ...list[0], sets: [set(true), set(true)] };
    expect(shouldStartRest(list as WorkoutExercise[], 0, after)).toBe(true);
  });

  it("warm-ups don't number rounds", () => {
    const list = pair([set(true, { warmup: true }), set(false)], [set(false)]);
    const after = {
      ...list[0],
      sets: [set(true, { warmup: true }), set(true)],
    };
    expect(shouldStartRest(list as WorkoutExercise[], 0, after)).toBe(false);
  });
});

describe("set numbers and the current exercise", () => {
  it("numbers working sets, skipping warm-ups", () => {
    const sets = [{ warmup: true }, {}, {}];
    expect(workingSetNumber(sets, 1)).toBe(1);
    expect(workingSetNumber(sets, 2)).toBe(2);
  });

  it("a changed round number shifts the later sets, clearing resets them", () => {
    const sets: WorkoutSet[] = [{}, {}, {}];
    const shifted = updateSetInList(sets, 1, { number: 4 });
    expect(shifted.map((s) => s.number)).toEqual([undefined, 4, 5]);
    const cleared = updateSetInList(shifted, 1, { number: null });
    expect(cleared.map((s) => s.number)).toEqual([undefined, null, undefined]);
  });

  it("keeps shifted numbers within 1..8", () => {
    expect(
      updateSetInList([{}, {}, {}], 0, { number: 8 }).map((s) => s.number),
    ).toEqual([8, undefined, undefined]);
  });

  it("names the first open exercise or superset", () => {
    expect(currentStatus(day())).toMatchObject({
      names: ["Deadlifts"],
      setNumber: 1,
      setCount: 1,
      isSuperset: false,
    });
    const list = day();
    list[0] = { ...list[0], sets: [{ completed: true }] };
    expect(currentStatus(list)).toMatchObject({
      names: ["KB Swings", "Battle Ropes"],
      anchorIdx: 1,
      isSuperset: true,
    });
    expect(currentStatus([])).toBeNull();
  });
});
