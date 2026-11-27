/** The cases of LiftTrace's scripts/ai-date-guard and ai-date-tz tests */
import { afterEach, describe, expect, it, vi } from "vitest";

import { addDays, localDateStr } from "../lib/dates";
import { TOOL_SPECS } from "./catalog";
import { fakeLt } from "./fakeLt";
import { cleanRangeArgs } from "./guards";
import { runTool } from "./runTool";

const day = (offset = 0) => addDays(localDateStr(), offset);

const workout = (id: number, date: string, name: string) => ({
  id,
  date,
  completed: true,
  exercises: [
    {
      exercise_id: 1,
      exercise_name: name,
      sets: [{ weight: 135, reps: 5, completed: true }],
    },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("read ranges", () => {
  it("doesn't report a lift missing for an invented range", async () => {
    fakeLt().rows.push(
      workout(3, day(0), "Smith Bench Press"),
      workout(2, day(-7), "Smith Bench Press"),
      workout(1, day(-9), "Squat"),
    );
    const result = (await runTool("get_workouts", {
      date_from: "2024-04-27",
      date_to: "2024-05-27",
      exercise_name: "Smith Bench Press",
    })) as { note: string; results: unknown[] };
    expect(result.results).toHaveLength(2);
    expect(result.note).toContain(`Today is ${day(0)}`);
  });

  it("handles a plausible wrong year the same way", async () => {
    fakeLt().rows.push(workout(1, day(-3), "Deadlift"));
    const result = (await runTool("get_workouts", {
      date_from: day(-375),
      date_to: day(-365),
      exercise_name: "Deadlift",
    })) as { results: unknown[] };
    expect(result.results).toHaveLength(1);
  });

  it("leaves a real range with data alone", async () => {
    fakeLt().rows.push(workout(1, day(-2), "Bench Press"));
    await expect(
      runTool("get_workouts", { date_from: day(-10), date_to: day(0) }),
    ).resolves.toHaveLength(1);
  });

  it("stays empty when there is no data at all", async () => {
    fakeLt();
    await expect(
      runTool("get_workouts", {
        date_from: "2024-04-27",
        date_to: "2024-05-27",
      }),
    ).resolves.toEqual([]);
  });

  it("finds a lift last trained six weeks ago without dates", async () => {
    fakeLt().rows.push(
      workout(1, day(-45), "Overhead Press"),
      workout(2, day(-2), "Squat"),
    );
    await expect(
      runTool("get_workouts", { exercise_name: "Overhead Press" }),
    ).resolves.toMatchObject([{ date: day(-45) }]);
  });

  it("tidies malformed, future and inverted ranges", () => {
    expect(
      cleanRangeArgs({ date_from: "2026-13-45", date_to: "yesterday" }),
    ).toEqual({});
    expect(cleanRangeArgs({ date_to: day(30) }).date_to).toBe(day(0));
    expect(cleanRangeArgs({ date_from: day(5) }).date_from).toBeUndefined();
    expect(cleanRangeArgs({ date_from: day(-1), date_to: day(-20) })).toEqual({
      date_from: day(-20),
      date_to: day(-1),
    });
  });

  it("falls back for the other range tools too", async () => {
    fakeLt({
      "/cardio": (call: { query: { start: string } }) =>
        call.query.start.startsWith("2024")
          ? []
          : [{ date: day(-1), activity: "Run", duration_min: 30 }],
    });
    await expect(
      runTool("get_cardio", {
        date_from: "2024-01-01",
        date_to: "2024-02-01",
      }),
    ).resolves.toMatchObject({
      note: expect.stringContaining("Today is") as string,
      results: { count: 1 },
    });
  });
});

describe("write dates", () => {
  const bodyStats = () =>
    fakeLt({
      [`PUT /body-stats/${day(-1)}`]: { stats: { id: 1 } },
      [`PUT /body-stats/${day(-45)}`]: { stats: { id: 2 } },
      "PUT /body-stats/2024-04-27": { stats: { id: 3 } },
    });
  const writes = (calls: { method: string }[]) =>
    calls.filter((c) => c.method !== "GET");

  it("refuses an invented year, naming today and the way forward", async () => {
    const server = bodyStats();
    await expect(
      runTool("log_body_stat", {
        stat: "weight",
        value: 80,
        date: "2024-04-27",
      }),
    ).rejects.toThrow(new RegExp(`today is ${day(0)}.*date_confirmed`));
    expect(writes(server.calls)).toHaveLength(0);
  });

  it("allows ordinary backdating", async () => {
    const server = bodyStats();
    for (const date of [day(-1), day(-45)]) {
      await runTool("log_body_stat", { stat: "weight", value: 80, date });
    }
    expect(writes(server.calls)).toHaveLength(2);
  });

  it("lets a confirmed far date through", async () => {
    const server = bodyStats();
    await runTool("log_body_stat", {
      stat: "weight",
      value: 80,
      date: "2024-04-27",
      date_confirmed: true,
    });
    expect(writes(server.calls)).toHaveLength(1);
  });

  it("guards a prescription on target_date", async () => {
    fakeLt();
    await expect(
      runTool("add_coach_prescription", {
        trainee_id: 1,
        template_id: 1,
        target_date: day(400),
      }),
    ).rejects.toThrow(/date_confirmed/);
  });

  it("offers date_confirmed on dated writes only", () => {
    const properties = (name: string) =>
      TOOL_SPECS.find((t) => t.name === name)?.parameters.properties as Record<
        string,
        { description?: string } | undefined
      >;
    for (const name of [
      "log_workout",
      "log_body_stat",
      "log_cardio",
      "add_exercise_to_diary",
      "start_workout_from_template",
      "add_coach_prescription",
    ]) {
      expect(properties(name).date_confirmed, name).toBeDefined();
    }
    expect(properties("get_coach_prescription").date_confirmed).toBeUndefined();
    expect(properties("get_workouts").date_from?.description).toMatch(
      /Omit unless the user named/,
    );
  });
});

describe("time zones", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it.each([
    "Pacific/Auckland",
    "Pacific/Chatham",
    "Pacific/Tongatapu",
    "Pacific/Apia",
    "Pacific/Kiritimati",
    "UTC",
    "Europe/Berlin",
    "America/New_York",
    "Pacific/Honolulu",
    "Etc/GMT+12",
  ])("takes real dates in %s", async (zone) => {
    process.env.TZ = zone;
    const server = fakeLt({ "POST /cardio": { id: 1 } });
    await runTool("log_cardio", {
      date: day(0),
      activity: "Run",
      duration_min: 30,
    });
    expect(server.calls.at(-1)?.body).toMatchObject({ date: day(0) });
    const week = { date_from: day(-7), date_to: day(0) };
    expect(cleanRangeArgs(week)).toEqual(week);
    expect(
      cleanRangeArgs({ date_from: "2024-02-29", date_to: "2023-02-29" }),
    ).toEqual({ date_from: "2024-02-29" });
  });
});
