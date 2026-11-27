import { describe, expect, it } from "vitest";

import { CSV_COLUMNS, workoutToCsv } from "./workoutCsv";
import type { LoadType } from "./workoutTypes";

function rows(csv: string): string[][] {
  return csv
    .trim()
    .split("\r\n")
    .map((line) => line.split(","));
}

describe("workoutToCsv", () => {
  it("appends duration_sec last and fills the exercise column", () => {
    const { csv } = workoutToCsv({
      date: "2026-09-14",
      name: "Test",
      exercises: [
        {
          exercise_id: 1,
          exercise_name: "Bench Press",
          sets: [{ reps: 5, weight: 135, completed: true }],
        },
        {
          exercise_id: 2,
          exercise_name: "Plank",
          set_type: "time",
          sets: [{ reps: 0, weight: 0, duration_sec: 60, completed: true }],
        },
      ],
    });
    const [header, bench, plank] = rows(csv);
    expect(header).toEqual([...CSV_COLUMNS]);
    expect(header.slice(0, 17)).toEqual([
      "date",
      "workout",
      "exercise",
      "exercise_index",
      "superset",
      "set_index",
      "warmup",
      "reps",
      "weight",
      "weight_unit",
      "side",
      "rpe",
      "completed",
      "set_notes",
      "exercise_notes",
      "workout_notes",
      "workout_duration_min",
    ]);
    expect(header[17]).toBe("duration_sec");
    expect(bench[2]).toBe("Bench Press");
    expect(plank[2]).toBe("Plank");
    // A hold has no reps, so seconds can never be summed as reps
    expect(plank[7]).toBe("");
    expect(plank[17]).toBe("60");
    expect(bench[17]).toBe("");
  });

  it("writes one full row per set, CRLF-terminated", () => {
    const { csv, filename } = workoutToCsv(
      {
        date: "2026-11-25",
        name: "Push Day",
        notes: "felt good",
        duration_min: 55,
        exercises: [
          {
            exercise_name: "Bench",
            notes: "paused",
            superset_id: "ss1",
            sets: [
              { reps: 8, weight: 60, warmup: true, completed: true },
              { reps: 5, weight: 100, rpe: 8, notes: "hard", completed: false },
            ],
          },
        ],
      },
      "kg",
    );
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(rows(csv).slice(1)).toEqual([
      "2026-11-25,Push Day,Bench,1,ss1,1,true,8,60,kg,,,true,,paused,felt good,55,".split(
        ",",
      ),
      "2026-11-25,Push Day,Bench,1,ss1,2,false,5,100,kg,,8,false,hard,paused,felt good,55,".split(
        ",",
      ),
    ]);
    expect(filename).toBe("lifttrace-2026-11-25-push-day.csv");
  });

  it("splits L/R reps into one row per logged side", () => {
    const { csv } = workoutToCsv({
      exercises: [
        {
          exercise_name: "Lunge",
          sets: [
            { reps_l: 10, reps_r: 9, weight: 20, completed: true },
            { reps_l: 8, weight: 20, completed: true },
          ],
        },
      ],
    });
    const body = rows(csv).slice(1);
    expect(body.map((row) => [row[7], row[10]])).toEqual([
      ["10", "L"],
      ["9", "R"],
      ["8", "L"],
    ]);
  });

  it("expands a unilateral exercise's single reps into L and R rows", () => {
    const { csv } = workoutToCsv({
      exercises: [
        {
          exercise_name: "Curl",
          load_type: "unilateral",
          sets: [{ reps: 10, weight: 12, completed: true }],
        },
      ],
    });
    expect(
      rows(csv)
        .slice(1)
        .map((row) => [row[7], row[10]]),
    ).toEqual([
      ["10", "L"],
      ["10", "R"],
    ]);
  });

  it("takes the load type from the library when the exercise has none", () => {
    const workout = {
      exercises: [
        {
          exercise_id: 7,
          exercise_name: "Row",
          sets: [{ reps: 6, weight: 30, completed: true }],
        },
      ],
    };
    const library = new Map<number, LoadType>([[7, "unilateral"]]);
    expect(rows(workoutToCsv(workout, "lbs", library).csv)).toHaveLength(3);
    expect(rows(workoutToCsv(workout, "lbs").csv)).toHaveLength(2);
  });

  it("quotes cells with commas, quotes and line breaks", () => {
    const { csv } = workoutToCsv({
      name: 'Legs, "heavy"',
      exercises: [
        {
          exercise_name: "Squat",
          sets: [{ reps: 1, weight: 1, notes: "a\nb" }],
        },
      ],
    });
    expect(csv).toContain('"Legs, ""heavy"""');
    expect(csv).toContain('"a\nb"');
  });

  it("names the file after date and a safe workout name", () => {
    expect(workoutToCsv({ exercises: [] }).filename).toBe(
      "lifttrace-untitled-workout.csv",
    );
    expect(
      workoutToCsv({
        date: "2026-01-02",
        name: "  Upper / Lower!! ",
        exercises: [],
      }).filename,
    ).toBe("lifttrace-2026-01-02-upper-lower.csv");
    expect(workoutToCsv({ name: "!!!", exercises: [] }).filename).toBe(
      "lifttrace-untitled-workout.csv",
    );
  });
});
