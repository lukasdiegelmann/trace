import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWorkoutStore,
  type SaveBody,
  type WorkoutBackend,
} from "./workoutStore";
import type { WorkoutLog } from "./workoutTypes";

const DAY = "2026-11-26";

function fakeBackend(initial: Record<string, WorkoutLog> = {}) {
  const rows = new Map(Object.entries(initial));
  const saves: { date: string; body: SaveBody }[] = [];
  let nextId = 10;
  const backend: WorkoutBackend = {
    get: vi.fn((date: string) =>
      Promise.resolve({ workout: rows.get(date) ?? null }),
    ),
    sessions: vi.fn((date: string) => {
      const row = rows.get(date);
      return Promise.resolve({ sessions: row ? [row] : [] });
    }),
    save: vi.fn((date: string, body: SaveBody) => {
      saves.push({ date, body });
      const workout = { ...body, id: body.id ?? nextId++, date };
      rows.set(date, workout);
      return Promise.resolve({ workout });
    }),
    remove: vi.fn((date: string) => {
      rows.delete(date);
      return Promise.resolve({ ok: true });
    }),
  };
  return { backend, saves, rows };
}

const bench = { uuid: "e1", exercise_name: "Bench", sets: [{ uuid: "s1" }] };
const squat = { uuid: "e2", exercise_name: "Squat", sets: [{ uuid: "s2" }] };

describe("workout store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a change at once and saves it once, debounced", async () => {
    const { backend, saves } = fakeBackend();
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    const first = store.save(DAY, { exercises: [bench] });
    const second = store.save(DAY, { name: "Push", exercises: [bench] });
    expect(store.state.get().log?.name).toBe("Push");
    await vi.advanceTimersByTimeAsync(400);
    // Every caller's promise settles
    await expect(first).resolves.toMatchObject({ name: "Push" });
    await expect(second).resolves.toMatchObject({ name: "Push" });
    expect(saves).toHaveLength(1);
    expect(store.state.get().sessionId).toBe(10);
  });

  it("tombstones what was removed since the load", async () => {
    const { backend, saves } = fakeBackend({
      [DAY]: { id: 1, exercises: [bench, squat] },
    });
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    void store.save(DAY, { id: 1, exercises: [squat] });
    await vi.advanceTimersByTimeAsync(400);
    expect(saves[0]?.body.deleted_uuids).toEqual({
      exercises: ["e1"],
      sets: {},
    });
  });

  it("keeps a detail another device changed", async () => {
    const { backend, saves, rows } = fakeBackend({
      [DAY]: { id: 1, name: "Old", exercises: [bench] },
    });
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    rows.set(DAY, { id: 1, name: "Renamed elsewhere", exercises: [bench] });
    void store.save(DAY, {
      id: 1,
      name: "Old",
      notes: "hi",
      exercises: [bench],
    });
    await vi.advanceTimersByTimeAsync(400);
    expect(saves[0]?.body).toMatchObject({
      name: "Renamed elsewhere",
      notes: "hi",
    });
  });

  it("a waiting save of another day is sent, not replaced", async () => {
    const { backend, saves } = fakeBackend();
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    void store.save(DAY, { exercises: [bench] });
    void store.save("2026-11-27", { exercises: [squat] });
    await vi.advanceTimersByTimeAsync(400);
    expect(saves.map((s) => s.date)).toEqual([DAY, "2026-11-27"]);
  });

  it("a late save never replaces the day navigated to (#86)", async () => {
    const { backend } = fakeBackend({
      "2026-11-25": { id: 5, name: "Yesterday", exercises: [] },
    });
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    void store.save(DAY, { name: "Today", exercises: [bench] });
    await store.load("2026-11-25");
    await vi.advanceTimersByTimeAsync(400);
    expect(store.state.get().log?.name).toBe("Yesterday");
    expect(backend.save).toHaveBeenCalledTimes(1);
  });

  it("deleting drops its waiting save instead of resurrecting it", async () => {
    const { backend, saves } = fakeBackend({
      [DAY]: { id: 1, exercises: [bench] },
    });
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    void store.save(DAY, { id: 1, name: "edit", exercises: [bench] });
    await store.deleteSession(DAY, 1);
    await vi.advanceTimersByTimeAsync(400);
    expect(saves).toHaveLength(0);
    expect(store.state.get().log).toBeNull();
  });

  it("a new session is saved without the old id", async () => {
    const { backend, saves } = fakeBackend({
      [DAY]: { id: 1, exercises: [bench] },
    });
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    await store.startNewSession(DAY, { id: 1, name: "PM", exercises: [squat] });
    expect(saves[0]?.body.id).toBeUndefined();
    expect(saves[0]?.body.new_session).toBe(true);
    expect(store.state.get().log?.name).toBe("PM");
  });

  it("keeps the load error instead of an empty day", async () => {
    const { backend } = fakeBackend();
    vi.mocked(backend.get).mockRejectedValueOnce(new Error("down"));
    const store = createWorkoutStore(backend, DAY);
    await store.load(DAY);
    expect(store.state.get().loadError?.message).toBe("down");
  });
});
