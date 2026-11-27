import { describe, expect, it } from "vitest";

import {
  cardioSummary,
  compactVolume,
  datedLine,
  dayDomain,
  groupRecords,
  hasCompletedSet,
  measurementSeries,
  measurementUnit,
  mostActiveDay,
  parseRange,
  periodDeltas,
  progressSeries,
  rangeCalories,
  rangeStart,
  recentRecords,
  recordValue,
  weekGoal,
  withExercises,
  workoutDays,
} from "./statistics";
import {
  freshnessFor,
  levelsOf,
  muscleRecovery,
  rankOf,
  recoveryGroup,
} from "./statisticsMuscles";

const NOW = new Date("2026-03-11T12:00:00"); // a Wednesday

const workout = (date: string, isDone = true, completed = 1) => ({
  date,
  completed,
  exercises: [{ sets: [{ weight: 100, reps: 5, completed: isDone }] }],
});

describe("ranges", () => {
  it("reads the deep link and finds the start day", () => {
    expect(parseRange("1W")).toBe("1W");
    expect(parseRange("2W")).toBe("1M");
    expect(parseRange(null)).toBe("1M");
    expect(rangeStart("1W", null, NOW)).toBe("2026-03-04");
    expect(rangeStart("All", "2024-05-01", NOW)).toBe("2024-05-01");
    expect(rangeStart("All", null, NOW)).toBe("2000-01-01");
  });
});

// backends/lifttrace/scripts/recent-workouts.test.js
describe("recent workouts", () => {
  it("counts a day only with a completed set", () => {
    expect(hasCompletedSet({ date: "x", exercises: [] })).toBe(false);
    expect(hasCompletedSet(workout("x", false))).toBe(false);
    expect(hasCompletedSet(workout("x"))).toBe(true);
    expect(
      hasCompletedSet({
        date: "x",
        exercises: JSON.stringify(workout("x").exercises),
      }),
    ).toBe(true);
  });

  it("leaves out workouts with no exercises", () => {
    const empty = { date: "2026-03-01", exercises: "[]" };
    expect(withExercises([empty, workout("2026-03-02")])).toHaveLength(1);
    expect([...workoutDays([empty, workout("2026-03-02", false)])]).toEqual([]);
  });

  it("fills the week's goal from Monday", () => {
    expect(
      weekGoal(
        [
          workout("2026-03-09"),
          workout("2026-03-11"),
          workout("2026-03-08"),
          workout("2026-03-10", true, 0),
        ],
        4,
        NOW,
      ),
    ).toEqual({ count: 2, goal: 4, fraction: 0.5 });
    expect(weekGoal([], 0, NOW).goal).toBe(4);
  });

  it("compares with the window before", () => {
    const current = { volume: 750, workouts: 2, hasVolume: true };
    expect(
      periodDeltas([workout("2026-03-01")], "1W", "2026-03-04", current),
    ).toEqual({ volumePercent: 50, countPercent: 100, priorCount: 1 });
    expect(
      periodDeltas([workout("2026-02-01")], "1W", "2026-03-04", current),
    ).toBeNull();
    expect(
      periodDeltas([workout("2026-03-01")], "All", "2026-03-04", current),
    ).toBeNull();
  });

  it("estimates calories only with a full profile", () => {
    const rows = [{ ...workout("2026-03-10"), duration_min: 60 }];
    const profile = { weight_kg: 80, height_cm: 180, age: 30, sex: "male" };
    expect(rangeCalories(rows, profile, "2026-03-01", "2026-03-11")).toBe(371);
    expect(
      rangeCalories(
        rows,
        { ...profile, age: null },
        "2026-03-01",
        "2026-03-11",
      ),
    ).toBeNull();
  });
});

describe("records and progress", () => {
  const records = [
    {
      exerciseId: 1,
      name: "Bench",
      maxWeight: 100,
      maxReps: 5,
      date: "2026-01-02",
    },
    {
      exerciseId: "Plank",
      name: "Plank",
      maxDuration: 60,
      maxDurationWeight: 25,
      durationDate: "2026-02-01",
    },
    {
      exerciseId: 3,
      name: "Incline",
      maxWeight: 120,
      maxReps: 1,
      date: "2026-01-01",
    },
  ];

  it("labels lifts and holds", () => {
    expect(recordValue(records[0], "kg")).toBe("100 kg × 5");
    expect(recordValue(records[1], "kg")).toBe("1:00 @ 25 kg");
  });

  it("lists the newest first and groups by category, heaviest first", () => {
    expect(recentRecords(records, 2).map((r) => r.name)).toEqual([
      "Plank",
      "Bench",
    ]);
    const groups = groupRecords(records, [
      { id: 1, name: "Bench", category: "chest" },
      { id: 3, name: "Incline", category: "Chest" },
      { id: 9, name: "Plank", category: "mobility" },
    ]);
    expect(
      groups.map((g) => [g.category, g.records.map((r) => r.name)]),
    ).toEqual([
      ["chest", ["Incline", "Bench"]],
      ["other", ["Plank"]],
    ]);
  });

  it("charts only the latest session's kind, RPE with its session", () => {
    const series = progressSeries([
      { date: "2026-01-01", maxWeight: 100, avgRpe: 8 },
      { date: "2026-01-02", maxDuration: 30, avgRpe: 7 },
      { date: "2026-01-03", maxDuration: 60, avgRpe: 9 },
    ]);
    expect(series.isTimed).toBe(true);
    expect(series.points.map((p) => [p.value, p.rpe])).toEqual([
      [30, 7],
      [60, 9],
    ]);
    expect(series.stats).toEqual({ min: 30, max: 60, average: 45 });
    expect(progressSeries([]).stats).toBeNull();
  });
});

// backends/lifttrace/scripts/body-chart.test.js
describe("body weight chart", () => {
  const weights = [
    { date: "2025-06-11", value: 90 },
    { date: "2025-06-30", value: 89 },
    { date: "2026-05-01", value: 85 },
  ];
  const fat = [
    { date: "2025-06-30", value: 22 },
    { date: "2026-09-21", value: 18 },
    { date: "not-a-day", value: 1 },
  ];

  it("puts both series on one date axis", () => {
    const domain = dayDomain(weights, fat);
    const w = datedLine(weights).points;
    const f = datedLine(fat).points;
    // The same day is the same x, whatever each series' count.
    expect(f[0].x).toBe(w[1].x);
    expect(w[0].x).toBe(domain?.from);
    expect(f.at(-1)?.x).toBe(domain?.until);
    // A ten-month gap is more than ten times a 19-day gap.
    expect(w[2].x - w[1].x).toBeGreaterThan(10 * (w[1].x - w[0].x));
    expect(f).toHaveLength(2);
  });

  it("gives each series its own padded scale", () => {
    expect(datedLine(weights)).toMatchObject({ min: 84.75, max: 90.25 });
    expect(datedLine([{ date: "2026-01-01", value: 80 }])).toMatchObject({
      min: 78,
      max: 82,
    });
    expect(datedLine([]).points).toEqual([]);
    expect(dayDomain([])).toBeNull();
  });

  it("reads a measurement over time and names its unit", () => {
    expect(
      measurementSeries(
        [
          { date: "2026-02-01", stats: { waist: "80.5" } },
          { date: "2026-01-01", stats: { waist: 82 } },
          { date: "2026-03-01", stats: {} },
        ],
        "waist",
      ),
    ).toEqual([
      { date: "2026-01-01", value: 82 },
      { date: "2026-02-01", value: 80.5 },
    ]);
    expect(measurementUnit("waist", "kg")).toBe("cm");
    expect(measurementUnit("waist", "lbs")).toBe("in");
    expect(measurementUnit("bodyFat", "kg")).toBe("%");
  });
});

describe("cardio, weekdays and volume", () => {
  it("sums cardio weeks against the target", () => {
    const weekly = [
      { week: "a", minutes: 100 },
      { week: "b", minutes: 160 },
    ];
    expect(cardioSummary(weekly, 150)).toEqual({
      total: 260,
      peak: 160,
      average: 130,
      weeksOnTarget: 1,
    });
    expect(cardioSummary(weekly, 0).weeksOnTarget).toBe(0);
  });

  it("names the later weekday on a tie", () => {
    expect(
      mostActiveDay([
        { day: 1, count: 3 },
        { day: 2, count: 1 },
        { day: 5, count: 3 },
      ]),
    ).toBe(5);
    expect(mostActiveDay([{ day: 1, count: 0 }])).toBeNull();
  });

  it("writes volume compactly", () => {
    expect(compactVolume(12)).toBe("12");
    expect(compactVolume(4800)).toBe("4.8k");
    expect(compactVolume(1234567)).toBe("1.2M");
    expect(compactVolume(NaN)).toBe("0");
  });
});

describe("muscle map", () => {
  it("shades relative to the hardest-worked muscle", () => {
    const levels = levelsOf({ chest: 4, biceps: 1 });
    expect(levels.chest).toBe(4);
    expect(levels.biceps).toBe(1);
    expect(levels.calves).toBe(0);
    expect(Object.values(levelsOf({})).every((l) => l === 0)).toBe(true);
    expect(rankOf({ biceps: 1, chest: 4 }).worked).toEqual(["chest", "biceps"]);
    expect(rankOf({ chest: 1 }).missed).toHaveLength(17);
  });

  // backends/lifttrace/scripts/muscle-names.test.js
  it("recognizes catalog muscle names for recovery", () => {
    const cases: [string, string][] = [
      ["Pectoralis major", "chest"],
      ["Latissimus dorsi", "back"],
      ["Anterior deltoid", "shoulders"],
      ["Biceps brachii", "biceps"],
      ["Brachialis", "biceps"],
      ["Triceps brachii", "triceps"],
      ["abductors", "glutes"],
      ["abdominals", "core"],
      ["Rectus abdominis", "core"],
      ["Obliquus externus", "core"],
      ["Quadriceps femoris", "quads"],
      ["Gluteus maximus", "glutes"],
      ["Gastrocnemius", "calves"],
      ["Soleus", "calves"],
    ];
    for (const [name, group] of cases) expect(recoveryGroup(name)).toBe(group);
    expect(recoveryGroup("legs")).toBeNull();
  });

  it("counts hours since the last working set, holds included", () => {
    const now = new Date("2026-03-11T18:00:00").getTime();
    const library = [
      { id: 1, primary_muscles: ["chest"] },
      { id: 2, primary_muscles: [], category: "core" },
    ];
    const result = muscleRecovery(
      [
        {
          date: "2026-03-10",
          exercises: [
            {
              exercise_id: 1,
              sets: [
                { weight: 100, reps: 5, completed: true },
                { weight: 50, reps: 5, completed: true, warmup: true },
              ],
            },
            { exercise_id: 2, sets: [{ duration_sec: 60, completed: true }] },
          ],
        },
        {
          date: "2026-02-01",
          exercises: [
            {
              exercise_id: 1,
              sets: [{ weight: 100, reps: 5, completed: true }],
            },
          ],
        },
      ],
      library,
      7,
      now,
    );
    expect(result.chest).toEqual({ hoursAgo: 30, sets: 1 });
    expect(result.core.sets).toBe(1);
    expect(result.calves).toEqual({ hoursAgo: null, sets: 0 });
    expect(freshnessFor(30)).toBe("recovering");
    expect(freshnessFor(null)).toBe("untrained");
    expect(freshnessFor(100)).toBe("fresh");
  });
});
