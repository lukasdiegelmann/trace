import { describe, expect, it } from "vitest";

import {
  ageFromDob,
  calc1RM,
  cmToFtIn,
  countCompletedSets,
  defaultSetTypeForName,
  estimateWorkoutCalories,
  exerciseVolume,
  fmtDuration,
  fmtSetDuration,
  fmtSetLabel,
  fmtWeight,
  ftInToCm,
  generateWarmupSets,
  type HistoryEntry,
  isTimedSet,
  lastCompletedSession,
  maskDurationInput,
  parseDuration,
  resolveLoadType,
  resolveSetType,
  setVolume,
  type WorkoutSet,
} from "./workout";

// Cases from backends/lifttrace/scripts/set-type.test.js,
// last-session-before-day.test.js and last-session-autofill.test.js
describe("set type", () => {
  it("an explicit set_type wins, else a duration makes a set timed", () => {
    expect(isTimedSet({}, { reps: 5, weight: 100 })).toBe(false);
    expect(isTimedSet({}, { duration_sec: 60 })).toBe(true);
    expect(isTimedSet({}, { duration_sec: 0, reps: 10 })).toBe(false);
    expect(isTimedSet({ set_type: "time" }, { reps: 30 })).toBe(true);
    expect(isTimedSet({ set_type: "reps" }, { duration_sec: 45 })).toBe(false);
    expect(isTimedSet({ set_type: "bogus" }, { duration_sec: 45 })).toBe(true);
    expect(isTimedSet(null, { duration_sec: 20 })).toBe(true);
    expect(isTimedSet({}, null)).toBe(false);
  });

  it("volume ignores timed sets, including leftover reps after a flip", () => {
    expect(
      exerciseVolume({
        set_type: "time",
        sets: [
          { completed: true, weight: 25, reps: 30, duration_sec: 60 },
          { completed: true, weight: 25, reps: 0, duration_sec: 45 },
        ],
      }),
    ).toBe(0);
  });

  it("resolves the input type: own, data, library, pref, name, reps", () => {
    expect(resolveSetType({ set_type: "time" })).toBe("time");
    expect(resolveSetType({ sets: [{ duration_sec: 30 }] })).toBe("time");
    expect(resolveSetType({ sets: [{ reps: 8 }] }, "time")).toBe("reps");
    expect(resolveSetType({ sets: [] }, "time")).toBe("time");
    expect(resolveSetType({ exercise_id: 3 }, null, { 3: "time" })).toBe(
      "time",
    );
    expect(resolveSetType({ exercise_name: "Plank" })).toBe("time");
    expect(resolveSetType({ exercise_name: "Hang Clean" })).toBe("reps");
  });
});

describe("durations", () => {
  it("parseDuration reads the ways people type a hold", () => {
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("130")).toBe(90);
    expect(parseDuration("200")).toBe(120);
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("0:90")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1:02:05")).toBe(3725);
    expect(parseDuration("45s")).toBe(45);
    expect(parseDuration("2m")).toBe(120);
    expect(parseDuration("2 min")).toBe(120);
    expect(parseDuration("1m30s")).toBe(90);
    expect(parseDuration(" 0:45 ")).toBe(45);
    for (const bad of ["", "0", "abc", "1:", "1:75:00", null, undefined]) {
      expect(parseDuration(bad)).toBeNull();
    }
  });

  it("the live mask shows m:ss and agrees with the parser", () => {
    expect(["1", "13", "130"].map(maskDurationInput)).toEqual([
      "0:01",
      "0:13",
      "1:30",
    ]);
    expect(maskDurationInput("1:30")).toBe("1:30");
    expect(maskDurationInput("1:3")).toBe("0:13");
    expect(maskDurationInput("00045")).toBe("0:45");
    expect(maskDurationInput("")).toBe("");
    expect(maskDurationInput("abc")).toBe("");
    for (const typed of ["7", "45", "90", "130", "959", "1000"]) {
      expect(parseDuration(maskDurationInput(typed))).toBe(
        parseDuration(typed),
      );
    }
  });

  it("formats holds as time and lifts unchanged", () => {
    expect(fmtSetDuration(45)).toBe("0:45");
    expect(fmtSetDuration(75)).toBe("1:15");
    expect(fmtSetDuration(3725)).toBe("1:02:05");
    expect(fmtSetDuration(0)).toBe("");
    expect(fmtSetLabel({ set_type: "time" }, { duration_sec: 60 })).toBe(
      "1:00",
    );
    expect(fmtSetLabel({}, { duration_sec: 60, weight: 25 })).toBe("25×1:00");
    expect(fmtSetLabel({}, { reps: 8, weight: 135 })).toBe("135×8");
  });
});

describe("volume", () => {
  it("follows the load type", () => {
    expect(setVolume({ weight: 50, reps: 10 })).toBe(500);
    expect(setVolume({ weight: 20, reps: 10 }, "paired")).toBe(400);
    expect(setVolume({ weight: 20, reps_l: 8, reps_r: 6 }, "unilateral")).toBe(
      280,
    );
    expect(setVolume({ weight: 20, reps: 10 }, "unilateral")).toBe(400);
    expect(setVolume({ weight: 0, reps: 10 })).toBe(0);
  });

  it("skips warm-ups and open sets", () => {
    expect(
      exerciseVolume({
        sets: [
          { weight: 45, reps: 10, completed: true, warmup: true },
          { weight: 100, reps: 5, completed: true },
          { weight: 100, reps: 5, completed: false },
        ],
      }),
    ).toBe(500);
  });
});

const set = (
  weight: number,
  reps: number,
  isCompleted = true,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet => ({ weight, reps, completed: isCompleted, ...extra });

describe("lastCompletedSession", () => {
  const TODAY = "2026-10-16";
  const history: HistoryEntry[] = [
    {
      date: TODAY,
      sets: [set(150, 8), set(150, 8, false), set(150, 8, false)],
    },
    { date: "2026-10-13", sets: [set(145, 8), set(145, 8), set(145, 7)] },
    { date: "2026-10-09", sets: [set(145, 8), set(145, 8), set(145, 7)] },
    { date: "2026-10-06", sets: [set(140, 8), set(140, 8), set(140, 8)] },
  ];

  it("today is never its own last session", () => {
    const last = lastCompletedSession(history, { before: TODAY });
    expect(last?.date).toBe("2026-10-13");
    const current = exerciseVolume({
      load_type: "bilateral",
      sets: [set(150, 8), set(150, 8), set(150, 8, false)],
    });
    const previous = exerciseVolume({
      load_type: "bilateral",
      sets: last?.completed,
    });
    expect(Math.round(((current - previous) / previous) * 100)).toBe(-28);
  });

  it("a past day compares with the day before it", () => {
    expect(lastCompletedSession(history, { before: "2026-10-13" })?.date).toBe(
      "2026-10-09",
    );
    expect(lastCompletedSession(history, { before: "2026-10-06" })).toBeNull();
    expect(lastCompletedSession(history, { before: "2026-10-17" })?.date).toBe(
      TODAY,
    );
    expect(lastCompletedSession(history)?.date).toBe(TODAY);
  });

  it("an entry with no date never passes as before the day", () => {
    const undated = { sets: [set(1, 1)] } as unknown as HistoryEntry;
    expect(
      lastCompletedSession([undated, history[1]], { before: TODAY })?.date,
    ).toBe("2026-10-13");
  });

  it("skips unticked and warm-up-only sessions; copies working sets", () => {
    expect(
      lastCompletedSession([
        { date: "2026-09-19", sets: [set(100, 10, false)] },
        { date: "2026-09-15", sets: [set(100, 10), set(100, 8)] },
      ])?.date,
    ).toBe("2026-09-15");
    const last = lastCompletedSession([
      {
        date: "2026-09-15",
        sets: [set(45, 10, true, { warmup: true }), set(185, 5), set(185, 5)],
      },
    ]);
    expect(last?.completed).toHaveLength(3);
    expect(last?.working.map((s) => s.weight)).toEqual([185, 185]);
    expect(
      lastCompletedSession([
        { date: "2026-09-19", sets: [set(45, 10, true, { warmup: true })] },
        { date: "2026-09-12", sets: [set(185, 5)] },
      ])?.date,
    ).toBe("2026-09-12");
    expect(lastCompletedSession([])).toBeNull();
    expect(lastCompletedSession(null)).toBeNull();
  });
});

describe("helpers", () => {
  it("estimates 1RM with Epley", () => {
    expect(calc1RM(100, 1)).toBe(100);
    expect(calc1RM(100, 5)).toBe(117);
    expect(calc1RM(0, 5)).toBe(0);
  });

  it("estimates calories with Mifflin-St Jeor and MET", () => {
    expect(
      estimateWorkoutCalories(
        {
          duration_min: 60,
          exercises: [{ sets: [set(20, 10)] }],
        },
        { weight_kg: 80, height_cm: 180, age: 30, sex: "male" },
      ),
    ).toBe(371);
    expect(
      estimateWorkoutCalories(
        { exercises: [] },
        { weight_kg: 80, height_cm: 180, age: 30 },
      ),
    ).toBeNull();
    expect(
      estimateWorkoutCalories(
        { duration_min: 60 },
        { weight_kg: null, height_cm: 180, age: 30 },
      ),
    ).toBeNull();
  });

  it("converts heights", () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, in: 11 });
    expect(cmToFtIn(null)).toEqual({ ft: "", in: "" });
    expect(ftInToCm(5, 11)).toBe(180);
  });

  it("formats weights and durations", () => {
    expect(fmtWeight(102.5, "kg")).toBe("102.5 kg");
    expect(fmtWeight(100)).toBe("100 lbs");
    expect(fmtWeight(null)).toBe("—");
    expect(fmtDuration(45)).toBe("45m");
    expect(fmtDuration(65)).toBe("1h 5m");
    expect(fmtDuration(120)).toBe("2h");
    expect(fmtDuration(0)).toBe("—");
  });

  it("ramps warm-ups to the working weight", () => {
    expect(generateWarmupSets(20, "kg")).toEqual([]);
    expect(generateWarmupSets(225).map((s) => [s.weight, s.reps])).toEqual([
      [45, 8],
      [115, 5],
      [160, 3],
      [190, 2],
    ]);
  });
});

const calorieProfile = { weight_kg: 80, height_cm: 180, age: 35, sex: "male" };
const liftSets = (n: number, weight = 20) => [
  {
    sets: Array.from({ length: n }, () => ({
      weight,
      reps: 10,
      completed: true,
    })),
  },
];

describe("calorie estimate (issue #7)", () => {
  it("is Mifflin-St Jeor BMR times MET over the duration", () => {
    // BMR 800 + 1125 - 175 + 5 = 1755; 1755/24*5*1 = 365.6
    expect(
      estimateWorkoutCalories(
        { duration_min: 60, exercises: liftSets(10) },
        calorieProfile,
      ),
    ).toBe(366);
  });

  it("uses MET 6 above 200 volume per minute", () => {
    expect(
      estimateWorkoutCalories(
        { duration_min: 60, exercises: liftSets(10, 150) },
        calorieProfile,
      ),
    ).toBe(439);
  });

  it("assumes three minutes per working set without a duration", () => {
    expect(
      estimateWorkoutCalories({ exercises: liftSets(10) }, calorieProfile),
    ).toBe(183);
    expect(
      estimateWorkoutCalories({ exercises: [] }, calorieProfile),
    ).toBeNull();
  });

  it("differs by sex and needs weight, height and age", () => {
    const workout = { duration_min: 60, exercises: [] };
    const female = estimateWorkoutCalories(workout, {
      ...calorieProfile,
      sex: "female",
    });
    const unset = estimateWorkoutCalories(workout, {
      ...calorieProfile,
      sex: null,
    });
    expect(female).toBeLessThan(unset ?? 0);
    expect(
      estimateWorkoutCalories(workout, { ...calorieProfile, age: null }),
    ).toBeNull();
  });
});

describe("diary cases (issue #7)", () => {
  it("resolves the load type: instance, library, preference, bilateral", () => {
    expect(resolveLoadType({ load_type: "paired" }, "unilateral")).toBe(
      "paired",
    );
    expect(
      resolveLoadType({ exercise_id: 1 }, "unilateral", { 1: "paired" }),
    ).toBe("unilateral");
    expect(resolveLoadType({ exercise_id: 1 }, null, { 1: "paired" })).toBe(
      "paired",
    );
    expect(resolveLoadType({ exercise_id: 2 }, null, {})).toBe("bilateral");
  });

  it("the timed-by-name list is exact", () => {
    for (const name of [
      "Hang Clean",
      "Hang Snatch",
      "Hanging Leg Raise",
      "Barbell Glute Bridge",
      "Push Up to Side Plank",
      "Dead Bug",
      "Bench Press",
    ]) {
      expect(defaultSetTypeForName(name)).toBeNull();
    }
    for (const name of [
      "Plank",
      "Side Bridge",
      "Farmer's Walk",
      "L-Sit",
      "Wall Sit",
      "Dead Hang",
    ]) {
      expect(defaultSetTypeForName(name)).toBe("time");
    }
  });

  it("recorded data outranks the library and the name", () => {
    expect(
      resolveSetType({ exercise_name: "Plank", sets: [{ reps: 30 }] }, "time", {
        1: "time",
      }),
    ).toBe("reps");
    expect(
      resolveSetType(
        { exercise_id: 9, exercise_name: "Plank", sets: [] },
        null,
        { 9: "reps" },
      ),
    ).toBe("reps");
  });

  it("counts sets", () => {
    expect(
      countCompletedSets([
        { sets: [{ completed: true }, { completed: false }] },
        { sets: [{ completed: 1 }] },
      ]),
    ).toEqual({ completed: 2, total: 3 });
  });

  it("ages from a birthday", () => {
    const now = new Date("2026-11-25T12:00:00");
    expect(ageFromDob("1990-11-25", now)).toBe(36);
    expect(ageFromDob("1990-11-26", now)).toBe(35);
    expect(ageFromDob("nope", now)).toBeNull();
    expect(ageFromDob(null, now)).toBeNull();
  });

  it("ramps warm-ups in kg", () => {
    expect(generateWarmupSets(100, "kg").map((s) => s.weight)).toEqual([
      20, 50, 70, 85,
    ]);
    expect(generateWarmupSets(100, "kg").every((s) => s.warmup)).toBe(true);
    expect(generateWarmupSets(45, "lbs")).toEqual([]);
  });
});
