/* eslint-disable @typescript-eslint/naming-convention -- the tools' result keys */
/**
 * Backend rows shaped for the model: ids it can use for follow-ups are kept,
 * server noise is trimmed (LiftTrace `src/lib/aiTools.js`).
 */
import { exerciseVolume, isTimedSet } from "../lib/workout";
import type {
  WorkoutExercise,
  WorkoutLog,
  WorkoutSet,
} from "../lib/workoutTypes";
import type { ProgramWithTemplates } from "../programs/api";

/** The volume of completed working sets; holds carry none (issue #89) */
export function totalVolume(
  exercises: WorkoutExercise[] | null | undefined,
): number {
  return Math.round(
    (exercises ?? []).reduce((sum, e) => sum + exerciseVolume(e), 0),
  );
}

interface ShapedSet {
  weight: number | null;
  reps?: number | null;
  duration_sec?: number;
  rpe?: number;
  warmup?: boolean;
  completed: boolean;
}

interface TopSet {
  weight: number | null;
  reps?: number | null;
  duration_sec?: number;
}

function shapeExercise(exercise: WorkoutExercise) {
  const all: WorkoutSet[] = exercise.sets ?? [];
  const isTimed = all.some((s) => isTimedSet(exercise, s));
  // A hold is shown as a duration, never as reps (issue #89)
  const sets = all.map((s): ShapedSet => ({
    weight: s.weight ?? null,
    ...(isTimedSet(exercise, s)
      ? { duration_sec: Number(s.duration_sec) || 0 }
      : { reps: s.reps ?? null }),
    ...(s.rpe != null ? { rpe: s.rpe } : {}),
    ...(s.warmup ? { warmup: true } : {}),
    completed: !!s.completed,
  }));
  const measure = (s: ShapedSet) => (isTimed ? s.duration_sec : s.weight) ?? 0;
  const top = sets
    .filter((s) => s.completed && !s.warmup && measure(s) > 0)
    .reduce<ShapedSet | null>(
      (best, s) => (!best || measure(s) > measure(best) ? s : best),
      null,
    );
  const topSet: TopSet | null = top
    ? isTimed
      ? { weight: top.weight, duration_sec: top.duration_sec }
      : { weight: top.weight, reps: top.reps }
    : null;
  return {
    name: exercise.exercise_name ?? "",
    ...(exercise.exercise_id ? { exercise_id: exercise.exercise_id } : {}),
    ...(isTimed ? { set_type: "time" } : {}),
    sets,
    total_volume: totalVolume([exercise]),
    ...(topSet ? { top_set: topSet } : {}),
    ...(exercise.notes ? { notes: exercise.notes } : {}),
  };
}

export function shapeWorkout(workout: WorkoutLog) {
  const exercises = workout.exercises.map(shapeExercise);
  return {
    id: workout.id,
    date: workout.date,
    ...(workout.name ? { name: workout.name } : {}),
    ...(workout.duration_min != null
      ? { duration_min: workout.duration_min }
      : {}),
    completed: !!workout.completed,
    ...(workout.template_id ? { template_id: workout.template_id } : {}),
    ...(workout.program_id ? { program_id: workout.program_id } : {}),
    ...(workout.notes ? { notes: workout.notes } : {}),
    exercises,
    total_volume: exercises.reduce((sum, e) => sum + e.total_volume, 0),
    top_set_by_exercise: Object.fromEntries(
      exercises.flatMap((e) => (e.top_set ? [[e.name, e.top_set]] : [])),
    ),
  };
}

/** A template exercise as stored, with the older names of rest and weeks */
interface PlannedExercise {
  name?: string | null;
  exercise_name?: string | null;
  exercise_id?: number | null;
  target_sets?: unknown;
  target_reps?: unknown;
  target_weight?: unknown;
  target_rpe?: unknown;
  tempo?: string | null;
  rest_sec?: number | null;
  rest_seconds?: number | null;
  weeks?: unknown[] | null;
  week_overrides?: unknown;
}

function shapeTarget(exercise: PlannedExercise) {
  const rest = exercise.rest_seconds ?? exercise.rest_sec;
  const weeks =
    exercise.week_overrides ??
    (exercise.weeks?.length ? exercise.weeks : undefined);
  return {
    name: exercise.exercise_name || exercise.name,
    ...(exercise.exercise_id ? { exercise_id: exercise.exercise_id } : {}),
    ...(exercise.target_sets != null
      ? { target_sets: exercise.target_sets }
      : {}),
    ...(exercise.target_reps != null
      ? { target_reps: exercise.target_reps }
      : {}),
    ...(exercise.target_weight != null
      ? { target_load: exercise.target_weight }
      : {}),
    ...(exercise.target_rpe != null ? { target_rpe: exercise.target_rpe } : {}),
    ...(exercise.tempo ? { tempo: exercise.tempo } : {}),
    ...(rest != null ? { rest_seconds: rest } : {}),
    ...(weeks ? { week_overrides: weeks } : {}),
  };
}

export function shapeProgram(program: ProgramWithTemplates) {
  return {
    id: program.id,
    name: program.name,
    goal: program.goal,
    weeks: program.duration_weeks ?? 1,
    is_active: !!program.is_active,
    ...(program.current_week ? { current_week: program.current_week } : {}),
    templates: (program.templates ?? []).map((template) => ({
      id: template.id,
      name: template.name,
      ...(template.day_label ? { day_label: template.day_label } : {}),
      exercises: ((template.exercises ?? []) as PlannedExercise[]).map(
        shapeTarget,
      ),
    })),
  };
}
