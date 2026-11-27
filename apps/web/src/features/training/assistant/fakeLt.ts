/**
 * For tests: LiftTrace's API in memory, behind spies on `api.lt`, answering
 * the workout routes as the server does (every field written from the
 * request, exercises merged by uuid, new_session always a new row).
 */
import { vi } from "vitest";

import { api, ApiError, type RequestOptions } from "@/api";

import { ensureExerciseUuids } from "../lib/workoutUuid";
import type { WorkoutLog } from "../lib/workoutTypes";
import type { SaveWorkoutBody } from "../diary/api";

export interface LtCall {
  method: "GET" | "PUT" | "POST";
  path: string;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string>;
}

type Route = (call: LtCall) => unknown;

export function fakeLt(routes: Record<string, unknown> = {}) {
  const state = { rows: [] as WorkoutLog[], calls: [] as LtCall[] };
  const live = (date: string) =>
    state.rows.filter((r) => r.date === date && !r.deleted_at);

  function save(date: string, body: SaveWorkoutBody) {
    const target = body.new_session
      ? undefined
      : body.id != null
        ? state.rows.find((r) => r.id === body.id && r.date === date)
        : live(date).at(0);
    const sent = ensureExerciseUuids(body.exercises);
    const fields = {
      name: body.name ?? null,
      notes: body.notes || undefined,
      completed: body.completed ? 1 : 0,
      program_id: body.program_id || null,
      template_id: body.template_id || null,
      program_week: body.program_week ?? null,
    };
    if (!target) {
      const made = {
        id: 100 + state.rows.length,
        date,
        ...fields,
        exercises: sent,
      };
      state.rows.push(made);
      return { workout: structuredClone(made) };
    }
    const gone = new Set(body.deleted_uuids?.exercises ?? []);
    const merged = [
      ...target.exercises
        .filter((e) => !gone.has(e.uuid ?? ""))
        .map((e) => sent.find((s) => s.uuid === e.uuid) ?? e),
      ...sent.filter((s) => !target.exercises.some((e) => e.uuid === s.uuid)),
    ];
    Object.assign(target, fields, { exercises: merged });
    return { workout: structuredClone(target) };
  }

  function answer(call: LtCall): unknown {
    const route = routes[`${call.method} ${call.path}`] ?? routes[call.path];
    if (route !== undefined) {
      return typeof route === "function" ? (route as Route)(call) : route;
    }
    const sessions = /^\/workout\/([\d-]+)\/sessions$/.exec(call.path);
    if (sessions) return { sessions: structuredClone(live(sessions[1])) };
    if (call.path === "/workout/recent") {
      return structuredClone(state.rows.filter((r) => !r.deleted_at));
    }
    const day = /^\/workout\/(\d{4}-\d{2}-\d{2})$/.exec(call.path);
    if (day && call.method === "PUT") {
      return save(day[1], call.body as SaveWorkoutBody);
    }
    if (day) {
      const { id } = call.query;
      const found =
        id != null
          ? state.rows.find((r) => r.date === day[1] && r.id === id)
          : live(day[1]).at(0);
      return { workout: found ? structuredClone(found) : null };
    }
    if (call.path === "/settings") return { weightUnit: "kg" };
    throw new ApiError("lt", 404, { error: `unexpected ${call.path}` });
  }

  const respond = (
    method: LtCall["method"],
    path: string,
    body: unknown,
    options: RequestOptions | undefined,
  ) => {
    // The path may carry its own query
    const [bare = "", search] = path.split("?");
    const query: Record<string, unknown> = {
      ...Object.fromEntries(new URLSearchParams(search)),
    };
    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value != null) query[key] = value;
    }
    const call = {
      method,
      path: bare,
      query,
      body,
      headers: options?.headers ?? {},
    };
    state.calls.push(call);
    return new Promise<never>((resolve, reject) => {
      try {
        resolve(answer(call) as never);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  vi.spyOn(api.lt, "get").mockImplementation((path, options) =>
    respond("GET", path, undefined, options),
  );
  vi.spyOn(api.lt, "put").mockImplementation((path, body, options) =>
    respond("PUT", path, body, options),
  );
  vi.spyOn(api.lt, "post").mockImplementation((path, body, options) =>
    respond("POST", path, body, options),
  );
  return state;
}
