/**
 * What the workout-complete sheet and the share card show, ported from
 * LiftTrace `src/components/diary/WorkoutSummary.svelte` and
 * `src/lib/workoutCard.js`.
 */
import { exerciseVolume } from "./workout";
import type { WorkoutExercise, WorkoutLog } from "./workoutTypes";

/**
 * The saved duration when there is one, else the running timer of the
 * workout's date (minutes, 1 decimal), else the saved value or 0.
 */
export function effectiveDuration(
  saved: number | null | undefined,
  timerMinutes: number | null | undefined,
): number {
  if (saved && saved > 0) return saved;
  if (timerMinutes != null) return Math.round(timerMinutes * 10) / 10;
  return saved || 0;
}

/** "1h 5m", "45m", "—" for none */
export function fmtSummaryDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "12.3k" from 1000 on, else the whole number; `locale` formats with Intl */
export function fmtVolume(volume: number, locale?: string): string {
  if (volume >= 1000) {
    const thousands = volume / 1000;
    return locale
      ? `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(thousands)}k`
      : `${thousands.toFixed(1)}k`;
  }
  return locale
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(volume)
    : String(Math.round(volume));
}

export interface SummaryStats {
  /** Completed working sets, rounded */
  volume: number;
  /** Completed sets without warm-ups */
  sets: number;
  /** Exercises with at least one completed working set */
  exercises: number;
}

export function summaryStats(
  workout: Pick<WorkoutLog, "exercises"> | null | undefined,
): SummaryStats {
  if (!workout) return { volume: 0, sets: 0, exercises: 0 };
  let volume = 0;
  let sets = 0;
  let exercises = 0;
  for (const exercise of workout.exercises) {
    const working = (exercise.sets ?? []).filter(
      (set) => set.completed && !set.warmup,
    );
    if (working.length > 0) exercises++;
    sets += working.length;
    volume += exerciseVolume(exercise);
  }
  return { volume: Math.round(volume), sets, exercises };
}

export type SummaryGroup =
  | { kind: "single"; exercise: WorkoutExercise }
  | { kind: "superset"; members: WorkoutExercise[] };

/**
 * Exercises with at least one completed set (warm-ups count), consecutive
 * ones sharing a superset_id grouped into one block.
 */
export function groupCompletedExercises(
  exercises: readonly WorkoutExercise[] | null | undefined,
): SummaryGroup[] {
  const done = (exercises ?? []).filter((exercise) =>
    (exercise.sets ?? []).some((set) => set.completed),
  );
  const groups: SummaryGroup[] = [];
  let i = 0;
  while (i < done.length) {
    const exercise = done[i];
    const supersetId = exercise.superset_id;
    if (supersetId) {
      const members: WorkoutExercise[] = [];
      while (i < done.length && done[i]?.superset_id === supersetId) {
        members.push(done[i]);
        i++;
      }
      groups.push({ kind: "superset", members });
    } else {
      groups.push({ kind: "single", exercise });
      i++;
    }
  }
  return groups;
}
