/* eslint-disable @typescript-eslint/naming-convention -- the tools' names, arguments and the backend's JSON */
/**
 * The cases of LiftTrace's scripts/trace-workout-target and ai-tools-wiring
 * tests: the tools read and write the workout they mean, and the diary shows
 * what they saved.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api";

import { diaryStore, resetDiaryStore } from "../diary/diaryStore";
import { addDays, localDateStr } from "../lib/dates";
import { ensureExerciseUuids } from "../lib/workoutUuid";
import type { WorkoutLog } from "../lib/workoutTypes";
import { TOOL_SPECS } from "./catalog";
import { trainingContext } from "./context";
import { fakeLt, type LtCall } from "./fakeLt";
import { EXECUTORS, runTool } from "./runTool";

/** Recent, so that the write guard lets it through */
const DAY = addDays(localDateStr(), -6);
const DAY_BEFORE = addDays(DAY, -1);

const program = {
  id: 1,
  name: "PPL",
  is_active: true,
  current_week: 3,
  duration_weeks: 6,
  templates: [],
};

const legDay = {
  id: 3,
  program_id: 1,
  name: "Leg Day",
  exercises: [{ exercise_id: 7, exercise_name: "Squat", target_sets: 2 }],
};

const routes = (extra: Record<string, unknown> = {}) => ({
  "/exercises": (call: LtCall) =>
    [
      { id: 9, name: "Dips" },
      { id: 8, name: "Bench Press" },
    ].filter((e) =>
      e.name.toLowerCase().includes(String(call.query.search).toLowerCase()),
    ),
  "/templates/3": legDay,
  "/programs/1": program,
  "/programs": [program],
  ...extra,
});

function rows(): WorkoutLog[] {
  return [
    {
      id: 1,
      date: DAY,
      name: "Mobility",
      exercises: ensureExerciseUuids([
        {
          exercise_id: 5,
          exercise_name: "Hip Opener",
          sets: [{ reps: 10, weight: 0, completed: true }],
        },
      ]),
    },
    {
      id: 2,
      date: DAY,
      name: "Push",
      exercises: ensureExerciseUuids([
        {
          exercise_id: 8,
          exercise_name: "Bench Press",
          sets: [{ reps: 8, weight: 60, completed: false }],
        },
      ]),
    },
  ];
}

function setup(extra?: Record<string, unknown>) {
  const server = fakeLt(routes(extra));
  server.rows = rows();
  const names = (id: number) =>
    server.rows.find((r) => r.id === id)?.exercises.map((e) => e.exercise_name);
  const puts = () => server.calls.filter((c) => c.method === "PUT");
  return { server, names, puts };
}

const open = async (id: number) => {
  await diaryStore.load(DAY, id);
};

const dips = { name: "Dips", sets: [{ weight: 0, reps: 10 }] };

beforeEach(() => {
  resetDiaryStore();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("which workout the tools mean", () => {
  it("log_set writes into the workout it was given", async () => {
    const { server, names, puts } = setup();
    await open(1);
    await runTool("log_set", {
      workout_id: 2,
      exercise_name: "Bench",
      weight: 62.5,
      reps: 8,
    });
    expect(server.rows[1]?.exercises[0]?.sets).toHaveLength(2);
    expect(server.rows[0]?.name).toBe("Mobility");
    expect(names(1)).toEqual(["Hip Opener"]);
    expect(puts()[0]?.body).toMatchObject({ id: 2 });
    // The one open in the diary is another: it stays
    expect(diaryStore.state.get().log?.id).toBe(1);
  });

  it("get_workout shows the one asked for", async () => {
    const { server } = setup();
    await expect(runTool("get_workout", { id: 2 })).resolves.toMatchObject({
      name: "Push",
    });
    expect(server.calls.at(-1)?.query).toEqual({ id: 2 });
  });

  it.each([
    ["add_exercise_to_diary", { exercise_name: "Dips", date: DAY }],
    ["log_workout", { date: DAY, exercises: [dips] }],
  ])("%s writes into the workout open in the diary", async (name, args) => {
    const { server, names } = setup();
    await open(2);
    await runTool(name, args);
    expect(names(1)).toEqual(["Hip Opener"]);
    expect(names(2)).toEqual(["Bench Press", "Dips"]);
    // And the diary has what was saved
    expect(diaryStore.state.get().log?.exercises).toEqual(
      server.rows[1]?.exercises,
    );
  });

  it("uses the date's first with the diary on another date", async () => {
    const { names } = setup();
    await diaryStore.load(DAY_BEFORE);
    await runTool("add_exercise_to_diary", {
      exercise_name: "Dips",
      date: DAY,
    });
    expect(names(1)).toEqual(["Hip Opener", "Dips"]);
    expect(diaryStore.state.get().date).toBe(DAY_BEFORE);
  });

  it("leaves a workout deleted elsewhere deleted", async () => {
    const { server, names } = setup();
    await open(2);
    server.rows[1].deleted_at = `${DAY} 19:00:00`;
    await runTool("add_exercise_to_diary", {
      exercise_name: "Dips",
      date: DAY,
    });
    expect(names(1)).toEqual(["Hip Opener", "Dips"]);
    expect(names(2)).toEqual(["Bench Press"]);
  });

  it("stops when the open workout can't be read", async () => {
    let isDown = false;
    const { server, puts } = setup({
      [`GET /workout/${DAY}`]: (call: LtCall) => {
        if (isDown) throw new ApiError("lt", 503, { error: "down" });
        return { workout: server.rows.find((r) => r.id === call.query.id) };
      },
    });
    await open(2);
    isDown = true;
    await expect(
      runTool("add_exercise_to_diary", { exercise_name: "Dips", date: DAY }),
    ).rejects.toThrow("down");
    expect(puts()).toHaveLength(0);
  });

  it.each([
    [
      "log_set",
      { workout_id: 1, exercise_name: "Hip", weight: 0, reps: 12 },
      "exercises",
    ],
    [
      "add_exercise_to_diary",
      { exercise_name: "Dips", date: DAY },
      "exercises",
    ],
    ["log_workout", { date: DAY, exercises: [dips] }, "exercises,completed"],
    [
      "log_workout",
      { date: DAY, name: "Arms", duration_min: 30, exercises: [dips] },
      "exercises,completed,name,duration_min",
    ],
  ])(
    "%s keeps the rest of the workout and names what it changed",
    async (name, args, changed) => {
      const { server, puts } = setup();
      const kept = {
        notes: "felt strong",
        completed: 1,
        program_id: 1,
        template_id: 4,
        program_week: 2,
      };
      Object.assign(server.rows[0] ?? {}, kept);
      await open(1);
      await runTool(name, args);
      expect(server.rows[0]).toMatchObject(kept);
      expect(puts()[0]?.headers["X-Changed-Fields"]).toBe(changed);
      const body = puts()[0]?.body as WorkoutLog;
      expect(
        body.exercises.every(
          (e) => e.uuid && (e.sets ?? []).every((s) => s.uuid),
        ),
      ).toBe(true);
    },
  );

  it("sends a waiting diary change first and saves on top of it", async () => {
    const { names } = setup();
    await open(2);
    const shown = diaryStore.state.get().log;
    const waiting = diaryStore.save(DAY, {
      ...shown,
      exercises: [
        ...(shown?.exercises ?? []),
        { exercise_name: "Fly", sets: [{ reps: 12 }] },
      ],
    });
    await runTool("add_exercise_to_diary", {
      exercise_name: "Dips",
      date: DAY,
    });
    await expect(waiting).resolves.toBeDefined();
    expect(names(2)).toEqual(["Bench Press", "Fly", "Dips"]);
    expect(
      diaryStore.state.get().log?.exercises.map((e) => e.exercise_name),
    ).toEqual(["Bench Press", "Fly", "Dips"]);
  });

  it("keeps a timed exercise's sets timed", async () => {
    const { server } = setup();
    server.rows[1].exercises[0].set_type = "reps";
    await expect(
      runTool("log_set", {
        workout_id: 2,
        exercise_id: 0,
        weight: 0,
        duration_sec: 60,
      }),
    ).rejects.toThrow("tracked by reps");
  });
});

describe("start_workout_from_template", () => {
  const start = () =>
    runTool("start_workout_from_template", {
      template_id: 3,
      date: DAY,
    }) as Promise<{ workout_id: number; new_workout: boolean }>;

  it("starts a new workout beside one under way, and opens it", async () => {
    const { server, names } = setup();
    await open(2);
    const out = await start();
    expect(out.new_workout).toBe(true);
    expect(names(2)).toEqual(["Bench Press"]);
    expect(diaryStore.state.get().sessionId).toBe(out.workout_id);
    await runTool("add_exercise_to_diary", {
      exercise_name: "Dips",
      date: DAY,
    });
    expect(names(out.workout_id)).toEqual(["Squat", "Dips"]);
    expect(server.rows.find((r) => r.id === out.workout_id)?.program_week).toBe(
      3,
    );
  });

  it("fills an empty open workout, keeping notes and finished mark", async () => {
    const { server } = setup();
    server.rows.push({
      id: 3,
      date: DAY,
      notes: "warm up first",
      completed: 1,
      exercises: [],
    });
    await open(3);
    await start();
    expect(server.rows).toHaveLength(3);
    expect(server.rows[2]).toMatchObject({
      name: "Leg Day",
      notes: "warm up first",
      completed: 1,
      program_week: 3,
      template_id: 3,
    });
    expect(server.rows[2]?.exercises[0]?.sets).toHaveLength(2);
  });

  it("records no week for a program not being followed", async () => {
    const { server } = setup({
      "/programs/1": { ...program, is_active: false, current_week: null },
    });
    const out = await start();
    expect(
      server.rows.find((r) => r.id === out.workout_id)?.program_week,
    ).toBeNull();
  });

  it("finds a template by name", async () => {
    setup({ "/programs/1": { ...program, templates: [legDay] } });
    await expect(
      runTool("start_workout_from_template", {
        template_name: "leg",
        date: DAY,
      }),
    ).resolves.toMatchObject({ from_template: { id: 3, name: "Leg Day" } });
  });
});

describe("body stats", () => {
  it("stores LiftTrace's own keys and numbers, in the user's unit", async () => {
    const { puts } = setup({
      [`PUT /body-stats/${DAY}`]: { stats: { id: 4 } },
    });
    await expect(
      runTool("log_body_stat", {
        stat: "body_fat",
        value: 15,
        date: DAY,
      }),
    ).resolves.toMatchObject({ id: 4, stat: "bodyFat", unit: "%" });
    expect(puts()[0]?.body).toEqual({ stats: { bodyFat: 15 } });
  });

  it("refuses what the server would drop, and the other unit", async () => {
    const { puts } = setup();
    await expect(
      runTool("log_body_stat", { stat: "wingspan", value: 180 }),
    ).rejects.toThrow("can't store");
    await expect(
      runTool("log_body_stat", { stat: "weight", value: 180, unit: "lb" }),
    ).rejects.toThrow("in kg");
    expect(puts()).toHaveLength(0);
  });
});

describe("the tool surface", () => {
  it("dispatches every tool and names each in the prompt", async () => {
    setup();
    const names = TOOL_SPECS.map((t) => t.name);
    expect(names).toHaveLength(21);
    expect(Object.keys(EXECUTORS).sort()).toEqual([...names].sort());
    const prompt = await trainingContext();
    for (const name of names) expect(prompt).toContain(name);
    expect(prompt).toContain("does NOT appear in get_workouts");
    expect(prompt).toContain("Never report a hold's seconds as reps");
  });

  it("never hands over progress photo images", async () => {
    const { server } = setup({
      "/body-stats/photos": {
        photos: [{ id: 1, date: DAY, url: "/uploads/private.jpg" }],
      },
      "/body-stats/range": [{ date: DAY, stats: { weight: 80 } }],
    });
    const result = await runTool("get_progress_photos");
    expect(result).toMatchObject({
      count: 1,
      entries: [{ date: DAY, photos: 1, weight: 80, weight_unit: "kg" }],
    });
    expect(JSON.stringify(result)).not.toMatch(/uploads|\/file|base64/);
    expect(server.calls.some((c) => c.path.includes("/file"))).toBe(false);
  });
});
