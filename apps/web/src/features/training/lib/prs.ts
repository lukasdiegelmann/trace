/**
 * Personal records while logging, ported from LiftTrace
 * `routes/Diary.svelte` (`loadPrevBests`, `prFlagsByIdx`, the PR check in
 * `updateExercise`). Only days other than the diary's count as "before".
 */
import { calc1RM, isTimedSet } from "./workout";
import type { HistoryEntry } from "./workoutTypes";
import type { WorkoutExercise, WorkoutSet } from "./workoutTypes";

export interface PreviousBest {
  topWeight: number;
  /** Unrounded Epley of the best set */
  topE1rm: number;
  topDuration: number;
  topDurationWeight: number;
}

/** The best of an exercise's history, the diary's own day left out */
export function previousBest(
  history: HistoryEntry[],
  date: string,
): PreviousBest {
  const best: PreviousBest = {
    topWeight: 0,
    topE1rm: 0,
    topDuration: 0,
    topDurationWeight: 0,
  };
  for (const entry of history) {
    if (entry.date === date) continue;
    for (const set of entry.sets ?? []) {
      if (!set.completed || set.warmup) continue;
      if (isTimedSet({ set_type: entry.set_type }, set)) {
        const duration = Number(set.duration_sec) || 0;
        if (duration > best.topDuration) best.topDuration = duration;
        const weight = set.weight ?? 0;
        if (duration > 0 && weight > best.topDurationWeight) {
          best.topDurationWeight = weight;
        }
        continue;
      }
      const weight = set.weight ?? 0;
      const reps = set.reps ?? 0;
      if (weight > best.topWeight) best.topWeight = weight;
      const e1rm = weight * (1 + reps / 30);
      if (e1rm > best.topE1rm) best.topE1rm = e1rm;
    }
  }
  return best;
}

/** Per exercise position, the indices of completed sets that beat the best */
export function prFlags(
  exercises: WorkoutExercise[],
  bests: Record<string, PreviousBest | undefined>,
): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  exercises.forEach((exercise, exIdx) => {
    const best =
      exercise.exercise_id != null
        ? bests[String(exercise.exercise_id)]
        : undefined;
    if (!best) return;
    const indices = new Set<number>();
    (exercise.sets ?? []).forEach((set, setIdx) => {
      if (!set.completed || set.warmup) return;
      if (isTimedSet(exercise, set)) {
        const duration = Number(set.duration_sec) || 0;
        if (!duration) return;
        const weight = set.weight ?? 0;
        if (
          duration > best.topDuration ||
          (weight > 0 && weight > best.topDurationWeight)
        ) {
          indices.add(setIdx);
        }
        return;
      }
      const weight = set.weight ?? 0;
      const reps = set.reps ?? 0;
      if (!weight || !reps) return;
      if (weight > best.topWeight || weight * (1 + reps / 30) > best.topE1rm) {
        indices.add(setIdx);
      }
    });
    if (indices.size) out.set(exIdx, indices);
  });
  return out;
}

export function countPrs(flags: Map<number, Set<number>>): number {
  let count = 0;
  for (const indices of flags.values()) count += indices.size;
  return count;
}

export type PrCelebration =
  | { kind: "hold"; durationSec: number; weight: number }
  | { kind: "weight" | "e1rm"; weight: number; reps: number };

/**
 * Is the set just completed a record worth celebrating? Needs a baseline: at
 * least one prior comparable set on another day.
 */
export function celebrationFor(
  exercise: WorkoutExercise,
  set: WorkoutSet,
  history: HistoryEntry[],
  date: string,
): PrCelebration | null {
  if (set.warmup) return null;
  if (isTimedSet(exercise, set)) {
    const duration = Number(set.duration_sec) || 0;
    if (duration <= 0) return null;
    let priorDuration = 0;
    let priorWeight = 0;
    let priorCount = 0;
    for (const entry of history) {
      if (entry.date === date) continue;
      for (const prior of entry.sets ?? []) {
        if (
          !prior.completed ||
          prior.warmup ||
          !isTimedSet({ set_type: entry.set_type }, prior)
        ) {
          continue;
        }
        const d = Number(prior.duration_sec) || 0;
        if (d <= 0) continue;
        priorCount++;
        priorDuration = Math.max(priorDuration, d);
        priorWeight = Math.max(priorWeight, prior.weight ?? 0);
      }
    }
    const weight = set.weight ?? 0;
    if (
      priorCount > 0 &&
      (duration > priorDuration || (weight > 0 && weight > priorWeight))
    ) {
      return { kind: "hold", durationSec: duration, weight };
    }
    return null;
  }
  const weight = set.weight ?? 0;
  if (weight <= 0) return null;
  let priorMax = 0;
  let priorE1rm = 0;
  let priorCount = 0;
  for (const entry of history) {
    if (entry.date === date) continue;
    for (const prior of entry.sets ?? []) {
      const priorWeight = prior.weight ?? 0;
      // Warm-ups never form the baseline, as for the PR badge (the old
      // notification counted them)
      if (
        prior.completed &&
        !prior.warmup &&
        priorWeight > 0 &&
        !isTimedSet({ set_type: entry.set_type }, prior)
      ) {
        priorCount++;
        priorMax = Math.max(priorMax, priorWeight);
        priorE1rm = Math.max(priorE1rm, calc1RM(priorWeight, prior.reps));
      }
    }
  }
  if (priorCount === 0) return null;
  const isWeightPr = weight > priorMax;
  const isE1rmPr = calc1RM(weight, set.reps) > priorE1rm;
  if (!isWeightPr && !isE1rmPr) return null;
  return {
    kind: isWeightPr ? "weight" : "e1rm",
    weight,
    reps: set.reps ?? 0,
  };
}

/** The set that went from open to completed between two versions */
export function justCompletedSet(
  before: WorkoutExercise,
  after: WorkoutExercise,
): WorkoutSet | undefined {
  const old = before.sets ?? [];
  return (after.sets ?? []).find(
    (set, i) => set.completed && !old[i]?.completed,
  );
}

/** Did a working set get completed? (rest timer, PRs, auto-finish) */
export function didCompleteWorkingSet(
  before: WorkoutExercise,
  after: WorkoutExercise,
): boolean {
  const count = (e: WorkoutExercise) =>
    (e.sets ?? []).filter((s) => s.completed && !s.warmup).length;
  return count(after) > count(before);
}

/** Every exercise has sets and every set is completed */
export function isWorkoutDone(exercises: WorkoutExercise[]): boolean {
  return (
    exercises.length > 0 &&
    exercises.every(
      (e) =>
        (e.sets ?? []).length > 0 && (e.sets ?? []).every((s) => s.completed),
    )
  );
}
