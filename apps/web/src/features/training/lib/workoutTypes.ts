/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON keys */
/**
 * The shapes of LiftTrace's workout data as the backend stores them
 * (`workout_log.exercises` JSON, `/api/workout/*`). Field names stay
 * snake_case: they go to and come from the backend unchanged.
 */

import type {
  LoadType,
  SetType,
  WorkoutExercise as SharedExercise,
  WorkoutSet as SharedSet,
} from "./workout";

export type { LoadType, SetType };

/**
 * A stored set. `./workout` also accepts strings (typed values); what the
 * diary reads and writes is narrower.
 */
export interface WorkoutSet extends SharedSet {
  weight?: number | null;
  reps?: number | null;
  /** Unilateral split: reps per side */
  reps_l?: number | null;
  reps_r?: number | null;
  /** Timed sets (issue #89): whole seconds */
  duration_sec?: number | null;
  completed?: boolean | number;
  warmup?: boolean;
  notes?: string;
  rpe?: number | null;
  /** Round override for asymmetric supersets; position + 1 when unset */
  number?: number | null;
}

/** One week of a periodised template (issue #13) */
export interface WeekSpec {
  sets?: number | null;
  reps?: string | number | null;
  weight?: string | number | null;
  duration?: string | number | null;
  tempo?: string | null;
  rest_sec?: number | null;
}

/** A per-set target of a template exercise */
export interface SetSpec {
  weight?: string | number | null;
  reps?: string | number | null;
  reps_l?: string | number | null;
  reps_r?: string | number | null;
  duration?: string | number | null;
  number?: number | null;
  warmup?: boolean;
  rpe?: number | null;
}

export interface WorkoutExercise extends SharedExercise {
  uuid?: string;
  exercise_id?: number | null;
  exercise_name?: string;
  category?: string;
  target_sets?: number | null;
  target_reps?: string | number | null;
  target_weight?: string | number | null;
  target_duration?: string | number | null;
  notes?: string;
  sets?: WorkoutSet[];
  load_type?: LoadType | null;
  set_type?: SetType | null;
  superset_id?: string | number | null;
  superset_size?: number | null;
  superset_position?: number | null;
  tempo?: string | null;
  rest_sec?: number | null;
  /** Template-only: per-set targets and the weeks matrix */
  set_specs?: SetSpec[];
  weeks?: (WeekSpec | null)[];
  /** Library enrichment, never saved */
  _library_load_type?: LoadType | null;
  _library_set_type?: SetType | null;
}

/** One past session of an exercise (GET /workout/history/:id) */
export interface HistoryEntry {
  date?: string;
  sets?: WorkoutSet[];
  notes?: string;
  set_type?: SetType;
}

/** `lastCompletedSession` over the diary's histories */
export interface LastSession extends HistoryEntry {
  /** Every completed set (warm-ups too): the Last Time row */
  completed: WorkoutSet[];
  /** Completed working sets: what auto-fill copies */
  working: WorkoutSet[];
}

export interface CoachFeedback {
  id: number;
  trainer_id?: number;
  exercise_idx?: number | null;
  exercise_uuid?: string | null;
  note: string;
  updated_at?: string;
  seen_by_member_at?: string | null;
  member_reply?: string | null;
  member_replied_at?: string | null;
  trainer_name?: string | null;
  trainer_avatar_url?: string | null;
}

export interface WorkoutLog {
  id?: number | null;
  date?: string;
  name?: string | null;
  notes?: string | null;
  duration_min?: number | null;
  completed?: boolean | number | null;
  template_id?: number | null;
  program_id?: number | null;
  program_week?: number | null;
  program_duration_weeks?: number | null;
  session_seq?: number;
  updated_at?: string;
  deleted_at?: string | null;
  exercises: WorkoutExercise[];
  feedback?: CoachFeedback[];
}
