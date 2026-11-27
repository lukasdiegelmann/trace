/**
 * Stable ids for exercises and sets (the server's per-uuid merge, "Option
 * C"), ported from LiftTrace `src/lib/workout-uuid.js`.
 */
import type { WorkoutExercise, WorkoutSet } from "./workoutTypes";

export function newUuid(): string {
  return crypto.randomUUID();
}

/** Every exercise and set gets a uuid; the same array back when none was missing */
export function ensureExerciseUuids(
  exercises: WorkoutExercise[],
): WorkoutExercise[] {
  const out = exercises.map(ensureUuids);
  return out.some((e, i) => e !== exercises[i]) ? out : exercises;
}

function ensureUuids(exercise: WorkoutExercise): WorkoutExercise {
  const next = exercise.uuid ? exercise : { ...exercise, uuid: newUuid() };
  const sets = exercise.sets;
  if (!sets || sets.every((set) => set.uuid)) return next;
  return {
    ...next,
    sets: sets.map((set) => (set.uuid ? set : { ...set, uuid: newUuid() })),
  };
}

/**
 * Exercises copied in from elsewhere (template, yesterday, a recent
 * workout) are new entries on that day and get new ids (issue #99).
 */
export function withFreshIds(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return exercises.map((exercise) => {
    const rest = { ...exercise };
    delete rest.uuid;
    const sets = rest.sets?.map((set): WorkoutSet => {
      const plain = { ...set };
      delete plain.uuid;
      return plain;
    });
    return ensureUuids({ ...rest, sets });
  });
}

export interface Tombstones {
  exercises: string[];
  sets: Record<string, string[]>;
}

/**
 * What the user deleted since the snapshot (the last copy read from the
 * server): exercises gone from `next`, and sets gone from an exercise that
 * stayed.
 */
export function diffTombstones(
  snapshot: WorkoutExercise[] | null | undefined,
  next: WorkoutExercise[] | null | undefined,
): Tombstones {
  const nextByUuid = new Map(
    (next ?? []).filter((e) => e.uuid).map((e) => [e.uuid, e]),
  );
  const exercises: string[] = [];
  const sets: Record<string, string[]> = {};
  for (const exercise of snapshot ?? []) {
    if (!exercise.uuid) continue;
    const kept = nextByUuid.get(exercise.uuid);
    if (!kept) {
      exercises.push(exercise.uuid);
      continue;
    }
    const keptSets = new Set(
      (kept.sets ?? []).map((set) => set.uuid).filter(Boolean),
    );
    const removed = (exercise.sets ?? [])
      .map((set) => set.uuid)
      .filter((uuid): uuid is string => !!uuid && !keptSets.has(uuid));
    if (removed.length) sets[exercise.uuid] = removed;
  }
  return { exercises, sets };
}
