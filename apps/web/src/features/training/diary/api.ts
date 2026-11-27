/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON keys */
/**
 * LiftTrace calls of the diary and the workout editor (old `LtApi` in
 * `src/lib/api.js`), with the backend's JSON shapes. Paths are relative to
 * `/lt/api`.
 */
import { api } from "@/api";

import type { Tombstones } from "../lib/workoutUuid";
import type {
  CoachFeedback,
  WorkoutExercise,
  WorkoutLog,
  HistoryEntry,
} from "../lib/workoutTypes";

const lt = api.lt;

// ── Workout log ────────────────────────────────────────────────────────────

export interface WorkoutResponse {
  workout: WorkoutLog | null;
}

export interface SaveWorkoutBody extends Partial<WorkoutLog> {
  exercises: WorkoutExercise[];
  deleted_uuids?: Tombstones;
  changed_uuids?: { exercises: string[]; sets: Record<string, string[]> };
  new_session?: boolean;
}

export interface SaveWorkoutResponse {
  workout: WorkoutLog | null;
  queued?: boolean;
}

export const workoutApi = {
  get: (date: string, id: number | null = null) =>
    lt.get<WorkoutResponse>(`/workout/${date}`, { query: { id } }),
  sessions: (date: string) =>
    lt.get<{ sessions: WorkoutLog[] }>(`/workout/${date}/sessions`),
  save: (date: string, body: SaveWorkoutBody) =>
    lt.put<SaveWorkoutResponse>(`/workout/${date}`, body),
  remove: (date: string, id: number | null = null) =>
    lt.delete<{ ok: boolean }>(`/workout/${date}`, { query: { id } }),
  feedback: (date: string) =>
    lt.get<CoachFeedback[]>(`/workout/${date}/feedback`),
  /** Newest first; `exercises` already parsed */
  recent: (limit = 30) =>
    lt.get<WorkoutLog[]>("/workout/recent", { query: { limit } }),
  /** Every session holding the exercise, newest first */
  history: (exerciseId: number) =>
    lt.get<HistoryEntry[]>(`/workout/history/${exerciseId}`),
};

// ── Coach feedback and prescriptions ───────────────────────────────────────

export interface InboxRow extends CoachFeedback {
  workout_date?: string;
  exercise_name?: string | null;
}

export const feedbackApi = {
  inbox: () => lt.get<InboxRow[]>("/coach-feedback/inbox"),
  /** One note, or all of them without an id */
  markSeen: (id: number | null = null) =>
    lt.post<{ ok: boolean }>("/coach-feedback/seen", id ? { id } : {}),
  unreadDates: () => lt.get<string[]>("/coach-feedback/unread-dates"),
  reply: (id: number, reply: string) =>
    lt.put<{ ok: boolean }>(`/coach-feedback/${id}/reply`, { reply }),
};

export type PrescriptionStatus = "pending" | "accepted" | "declined";

export interface Prescription {
  id: number;
  date?: string | null;
  status?: PrescriptionStatus;
  name?: string | null;
  notes?: string | null;
  trainer_name?: string | null;
  program_id?: number | null;
  program_name?: string | null;
  template_id?: number | null;
  template_name?: string | null;
  /** JSON text of the template's exercises */
  template_exercises?: string | null;
  exercises?: WorkoutExercise[] | null;
  day_label?: string | null;
}

/** A server from before the answers sends no status: accepted */
export const statusOf = (prescription: Prescription): PrescriptionStatus =>
  prescription.status ?? "accepted";

export const prescriptionApi = {
  forDate: (date: string) =>
    lt.get<Prescription | null>(`/prescriptions/my/${date}`),
  upcoming: () => lt.get<Prescription[]>("/prescriptions/my/upcoming/list"),
  answer: (id: number, answer: "accept" | "decline") =>
    lt.post<Prescription & { queued?: boolean }>(
      `/prescriptions/${id}/answer`,
      { answer },
    ),
};

// ── Programs and templates ─────────────────────────────────────────────────

export interface Template {
  id: number;
  name: string;
  program_id?: number;
  day_label?: string | null;
  exercises: WorkoutExercise[];
  duration_weeks?: number | null;
}

export interface Program {
  id: number;
  name: string;
  is_active?: number | boolean;
  duration_weeks?: number | null;
  current_week?: number | null;
  /** "repeat" loops the block, "hold" stays on the last week */
  on_complete?: string | null;
  created_by?: number | null;
  templates?: Template[];
}

export const programApi = {
  list: () => lt.get<Program[]>("/programs"),
  get: (id: number) => lt.get<Program>(`/programs/${id}`),
  /** null clears the pin and returns to auto-advance (issue #13) */
  setWeekCursor: (id: number, week: number | null) =>
    lt.post<unknown>(`/programs/${id}/week-cursor`, { week }),
  template: (id: number) => lt.get<Template>(`/templates/${id}`),
  saveTemplate: (
    id: number,
    body: {
      name: string;
      exercises: WorkoutExercise[];
      deleted_uuids: Tombstones;
    },
  ) => lt.put<Template>(`/templates/${id}`, body),
};

// ── Settings (server-synced keys of stores/settings.js) ────────────────────

export const settingsApi = {
  all: () => lt.get<Record<string, unknown>>("/settings"),
  save: (key: string, value: unknown) =>
    lt.put<{ ok: boolean }>("/settings", { key, value }),
};

// ── Cross-app: calories to NutriTrace (server proxy, PAT-based) ────────────

export interface NtWorkoutBody {
  date: string;
  name: string;
  duration_min: number;
  calories_burned: number;
  external_id: string;
}

export const federationApi = {
  logWorkout: (body: NtWorkoutBody) =>
    lt.post<unknown>("/nt/log-workout", body),
};

/** Web push services configured in Settings (Gotify, ntfy, Apprise) */
export const notifyApi = {
  send: (title: string, body: string, priority = 5) =>
    lt.post<unknown>("/notify", { title, body, priority }),
};
