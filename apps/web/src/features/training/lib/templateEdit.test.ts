import { describe, expect, it } from "vitest";

import {
  addSpec,
  addToSuperset,
  appendExercise,
  copyWeek,
  differsFromNext,
  disablePerSet,
  dissolveSuperset,
  enablePerSet,
  fieldFor,
  forSave,
  leaveSuperset,
  mergeSupersets,
  moveEditorExercise,
  newTemplateExercise,
  patchSpec,
  removeExercise,
  removeSpec,
  replaceExercise,
  setSpecNumber,
  setWeekValue,
  splitPatch,
  startSuperset,
  templateLoadType,
  templateSetType,
} from "./templateEdit";
import type { WorkoutExercise } from "./workoutTypes";

const ex = (
  name: string,
  more: Partial<WorkoutExercise> = {},
): WorkoutExercise => ({
  uuid: name,
  exercise_id: name.charCodeAt(0),
  exercise_name: name,
  target_sets: 3,
  ...more,
});

const inSs = (name: string, id: string, size = 2, position = 0) =>
  ex(name, {
    superset_id: id,
    superset_size: size,
    superset_position: position,
  });

const names = (list: WorkoutExercise[]) => list.map((e) => e.exercise_name);

describe("supersets", () => {
  const list = [ex("A"), inSs("B", "x"), inSs("C", "x", 2, 1), ex("D")];

  it("moves without splitting a superset", () => {
    expect(names(moveEditorExercise(list, 0, 1))).toEqual(["B", "C", "A", "D"]);
    expect(names(moveEditorExercise(list, 1, 1))).toEqual(["A", "C", "B", "D"]);
    expect(names(moveEditorExercise(list, 2, 1))).toEqual(["A", "D", "B", "C"]);
    expect(moveEditorExercise(list, 0, -1)).toBe(list);
    expect(moveEditorExercise(list, 3, 1)).toBe(list);
    expect(moveEditorExercise(list, 1, 1)[1]?.superset_position).toBe(0);
  });

  it("dissolves when only one member is left", () => {
    expect(removeExercise(list, 1)[1]?.superset_id).toBeUndefined();
  });

  it("moves a leaving member below the block", () => {
    const three = [
      inSs("A", "x", 3),
      inSs("B", "x", 3, 1),
      inSs("C", "x", 3, 2),
    ];
    expect(names(leaveSuperset(three, 1))).toEqual(["A", "C", "B"]);
  });

  it("joins behind the last member with the group's sets", () => {
    const next = addToSuperset(
      [
        inSs("A", "x"),
        inSs("B", "x", 2, 1),
        ex("C"),
        ex("D", { target_sets: 5 }),
      ],
      3,
      "x",
    );
    expect(names(next)).toEqual(["A", "B", "D", "C"]);
    expect(next[2]).toMatchObject({
      superset_id: "x",
      superset_size: 3,
      superset_position: 2,
      target_sets: 3,
    });
  });

  it("starts one with the first member's sets", () => {
    const next = startSuperset(
      [ex("A", { target_sets: 4 }), ex("B"), ex("C", { target_sets: 2 })],
      [2, 0],
      "n",
    );
    expect(names(next)).toEqual(["A", "C", "B"]);
    expect(next.slice(0, 2).map((e) => e.target_sets)).toEqual([4, 4]);
  });

  it("dissolves and merges", () => {
    expect(dissolveSuperset(list, "x").some((e) => e.superset_id != null)).toBe(
      false,
    );
    const merged = mergeSupersets(
      [
        inSs("A", "x"),
        inSs("B", "x", 2, 1),
        ex("C"),
        inSs("D", "y"),
        inSs("E", "y", 2, 1),
      ],
      "x",
      "y",
    );
    expect(names(merged)).toEqual(["A", "B", "D", "E", "C"]);
    expect(merged.slice(0, 4).map((e) => e.superset_position)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(merged[0]?.superset_id).toBe("y");
  });
});

describe("adding and replacing", () => {
  it("starts with 3×10 and the remembered load type", () => {
    expect(
      newTemplateExercise({ id: 7, name: "Curl" }, { "7": "paired" }, null),
    ).toMatchObject({ target_sets: 3, target_reps: "10", load_type: "paired" });
  });

  it("starts timed by library, memory or name; reps wins when chosen", () => {
    const plank = newTemplateExercise({ id: 1, name: "Plank" }, null, null);
    expect(plank).toMatchObject({
      set_type: "time",
      target_reps: "",
      target_duration: "",
    });
    expect(
      newTemplateExercise({ id: 1, name: "Plank" }, null, { "1": "reps" })
        .set_type,
    ).toBeUndefined();
    expect(
      newTemplateExercise({ id: 2, name: "X", set_type: "time" }, null, null)
        .set_type,
    ).toBe("time");
  });

  it("appends into a superset", () => {
    const next = appendExercise(
      [inSs("A", "x"), inSs("B", "x", 2, 1), ex("C")],
      ex("N", { uuid: undefined }),
      "x",
    );
    expect(names(next)).toEqual(["A", "B", "N", "C"]);
    expect(next[2]?.superset_size).toBe(3);
  });

  it("replaces the identity only, without stale library fields", () => {
    const old = {
      ...inSs("A", "x"),
      notes: "slow",
      _library_load_type: "paired" as const,
    };
    const [next] = replaceExercise([old], 0, { id: 9, name: "Z" });
    expect(next).toMatchObject({
      uuid: "A",
      exercise_id: 9,
      exercise_name: "Z",
      notes: "slow",
      superset_id: "x",
    });
    expect(next).not.toHaveProperty("_library_load_type");
    expect(forSave([old])[0]).not.toHaveProperty("_library_load_type");
  });
});

describe("load type and tracked by", () => {
  it("resolves the load type from the entry, library, then memory", () => {
    expect(templateLoadType(ex("A"), { "65": "unilateral" })).toBe(
      "unilateral",
    );
    expect(templateLoadType(ex("A", { load_type: "paired" }), null)).toBe(
      "paired",
    );
  });

  it("lets the prescription stand in for logged data", () => {
    expect(templateSetType(ex("Plank", { target_reps: "60" }), null)).toBe(
      "reps",
    );
    expect(templateSetType(ex("Plank"), null)).toBe("time");
    expect(
      templateSetType(ex("A", { set_specs: [{ duration: "1:00" }] }), null),
    ).toBe("time");
  });
});

describe("weeks", () => {
  const base = ex("A", { target_reps: "10", rest_sec: 90 });

  it("writes week 1 flat and later weeks sparse", () => {
    const one = setWeekValue([base], 0, "reps", "8", 1, 3);
    expect(one[0]?.target_reps).toBe("8");
    const three = setWeekValue([base], 0, "reps", "5", 3, 3);
    expect(three[0]?.weeks).toEqual([null, null, { reps: "5" }]);
    expect(setWeekValue(three, 0, "reps", "", 3, 3)[0]?.weeks?.[2]).toEqual({});
  });

  it("clears flat fields", () => {
    const cleared = setWeekValue([base], 0, "sets", NaN, 1, 1);
    expect(cleared[0]?.target_sets).toBe(0);
    expect(fieldFor(cleared[0] ?? base, "sets", 1, 1)).toBe("");
    expect(
      setWeekValue([base], 0, "rest_sec", NaN, 1, 1)[0]?.rest_sec,
    ).toBeNull();
  });

  it("copies a week into the next, for one or all", () => {
    expect(differsFromNext(base, 1, 2)).toBe(true);
    const all = copyWeek([base, ex("B")], 1, 2);
    expect(all[0]?.weeks?.[1]).toEqual({ sets: 3, reps: "10", rest_sec: 90 });
    expect(differsFromNext(all[0] ?? base, 1, 2)).toBe(false);
    expect(all[1]?.weeks?.[1]).toEqual({ sets: 3 });
    expect(copyWeek([base, ex("B")], 1, 2, 0)[1]?.weeks).toBeUndefined();
    expect(differsFromNext(base, 2, 2)).toBe(false);
  });
});

describe("per-set targets", () => {
  const specs = enablePerSet(
    [ex("A", { target_weight: "60", target_reps: "5" })],
    0,
  );

  it("seeds from the uniform targets and goes back", () => {
    expect(specs[0]?.set_specs).toEqual(
      Array(3).fill({ weight: "60", reps: "5" }),
    );
    expect(disablePerSet(specs, 0)[0]).not.toHaveProperty("set_specs");
  });

  it("keeps target_sets with the count", () => {
    expect(addSpec(specs, 0)[0]?.target_sets).toBe(4);
    expect(removeSpec(specs, 0, 0)[0]?.target_sets).toBe(2);
    const none = [0, 0, 0].reduce((list) => removeSpec(list, 0, 0), specs);
    expect(none[0]).not.toHaveProperty("set_specs");
    expect(
      patchSpec(specs, 0, 1, { rpe: 8, warmup: true })[0]?.set_specs?.[1],
    ).toMatchObject({ rpe: 8, warmup: true, weight: "60" });
  });

  it("cascades and clears round numbers", () => {
    const shifted = setSpecNumber(specs, 0, 1, 4);
    expect(shifted[0]?.set_specs?.map((s) => s.number)).toEqual([
      undefined,
      4,
      5,
    ]);
    expect(
      setSpecNumber(shifted, 0, 1, null)[0]?.set_specs?.map((s) => s.number),
    ).toEqual([undefined, undefined, undefined]);
    expect(
      setSpecNumber(shifted, 0, 1, 2)[0]?.set_specs?.[2]?.number,
    ).toBeUndefined();
  });

  it("splits reps per side and merges to the higher", () => {
    expect(splitPatch({ reps: "8" })).toEqual({ reps_l: "8", reps_r: "8" });
    expect(splitPatch({ reps: "8", reps_l: "6", reps_r: "9" })).toEqual({
      reps_l: null,
      reps_r: null,
      reps: 9,
    });
  });
});
