/**
 * Supersets, block reordering, rounds and set numbering of the diary,
 * ported from LiftTrace `routes/Diary.svelte` and
 * `components/diary/ExerciseCard.svelte`. All functions are pure: they
 * return new arrays and never change the exercises they get.
 *
 * A superset is a run of consecutive exercises sharing `superset_id` with
 * `superset_size > 1`; `superset_position` is the place inside it.
 */
import type { WorkoutExercise, WorkoutSet } from "./workoutTypes";

export type SupersetId = string | number;

export interface ExerciseGroup {
  type: "single" | "superset";
  /** Index of the group's first exercise in the flat list */
  startIdx: number;
  exercises: WorkoutExercise[];
  supersetId?: SupersetId;
  targetSets?: number;
}

export function isInSuperset(exercise: WorkoutExercise | undefined): boolean {
  return exercise?.superset_id != null && (exercise.superset_size ?? 0) > 1;
}

/** The blocks the diary renders: single exercises and superset runs */
export function groupExercises(exercises: WorkoutExercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  let i = 0;
  while (i < exercises.length) {
    const exercise = exercises[i];
    const id = exercise.superset_id;
    if (id != null && isInSuperset(exercise)) {
      const startIdx = i;
      const members: WorkoutExercise[] = [];
      while (i < exercises.length && exercises[i]?.superset_id === id) {
        members.push(exercises[i]);
        i++;
      }
      groups.push({
        type: "superset",
        startIdx,
        exercises: members,
        supersetId: id,
        targetSets: members[0]?.target_sets ?? 1,
      });
    } else {
      groups.push({ type: "single", startIdx: i, exercises: [exercise] });
      i++;
    }
  }
  return groups;
}

export function newSupersetId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function withoutSuperset(exercise: WorkoutExercise): WorkoutExercise {
  const rest = { ...exercise };
  delete rest.superset_id;
  delete rest.superset_size;
  delete rest.superset_position;
  return rest;
}

/**
 * Size and positions of a superset again after a change; one member left
 * is no superset any more.
 */
export function recalcSuperset(
  exercises: WorkoutExercise[],
  id: SupersetId,
): WorkoutExercise[] {
  const count = exercises.filter((e) => e.superset_id === id).length;
  let position = 0;
  return exercises.map((exercise) => {
    if (exercise.superset_id !== id) return exercise;
    if (count < 2) return withoutSuperset(exercise);
    return {
      ...exercise,
      superset_size: count,
      superset_position: position++,
    };
  });
}

/** The exercises at `indices` become one superset, placed at the first of them */
export function createSuperset(
  exercises: WorkoutExercise[],
  indices: number[],
  id: SupersetId = newSupersetId(),
): WorkoutExercise[] {
  if (indices.length < 2) return exercises;
  const picked = new Set(indices);
  const rest = exercises.filter((_, i) => !picked.has(i));
  const members = [...indices]
    .sort((a, b) => a - b)
    .map((i, position) => ({
      ...exercises[i],
      superset_id: id,
      superset_size: indices.length,
      superset_position: position,
    }));
  const insertAt = Math.min(...indices.map((i) => Math.min(i, rest.length)));
  return [...rest.slice(0, insertAt), ...members, ...rest.slice(insertAt)];
}

/** Moves the exercise behind the superset's last member and joins it */
export function joinSuperset(
  exercises: WorkoutExercise[],
  idx: number,
  id: SupersetId,
): WorkoutExercise[] {
  const exercise = idx >= 0 ? exercises.at(idx) : undefined;
  if (!exercise) return exercises;
  const rest = exercises.filter((_, i) => i !== idx);
  let insertAt = rest.length;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (rest[i]?.superset_id === id) {
      insertAt = i + 1;
      break;
    }
  }
  const next = [
    ...rest.slice(0, insertAt),
    { ...exercise, superset_id: id },
    ...rest.slice(insertAt),
  ];
  return recalcSuperset(next, id);
}

/**
 * Takes the exercise out of its superset. Leaving from the middle moves it
 * behind the block, so the remaining members stay one consecutive run.
 */
export function leaveSuperset(
  exercises: WorkoutExercise[],
  idx: number,
): WorkoutExercise[] {
  const exercise = idx >= 0 ? exercises.at(idx) : undefined;
  if (!exercise) return exercises;
  const id = exercise.superset_id;
  const rest = exercises.filter((_, i) => i !== idx);
  const remaining: number[] = [];
  if (id != null) {
    rest.forEach((e, i) => {
      if (e.superset_id === id) remaining.push(i);
    });
  }
  const isSplitting =
    remaining.some((i) => i < idx) && remaining.some((i) => i >= idx);
  const at = isSplitting ? (remaining[remaining.length - 1] ?? idx) + 1 : idx;
  const next = [
    ...rest.slice(0, at),
    withoutSuperset(exercise),
    ...rest.slice(at),
  ];
  return id != null ? recalcSuperset(next, id) : next;
}

/** Removes every member of the superset */
export function removeSuperset(
  exercises: WorkoutExercise[],
  id: SupersetId,
): WorkoutExercise[] {
  return exercises.filter((e) => String(e.superset_id) !== String(id));
}

/** Moves a whole block (drag and drop): group `from` to position `to` */
export function moveGroupTo(
  exercises: WorkoutExercise[],
  from: number,
  to: number,
): WorkoutExercise[] {
  const groups = groupExercises(exercises);
  if (from === to || from < 0 || to < 0 || from >= groups.length) {
    return exercises;
  }
  const [moved] = groups.splice(from, 1);
  groups.splice(Math.min(to, groups.length), 0, moved);
  return groups.flatMap((g) => g.exercises);
}

/**
 * Moves the block holding exercise `idx` one block up (-1) or down (+1): a
 * superset travels as a unit and an exercise steps over a whole superset.
 */
export function moveExercise(
  exercises: WorkoutExercise[],
  idx: number,
  direction: -1 | 1,
): WorkoutExercise[] {
  const groups = groupExercises(exercises);
  const from = groups.findIndex(
    (g) => idx >= g.startIdx && idx < g.startIdx + g.exercises.length,
  );
  if (from < 0) return exercises;
  const to = from + direction;
  if (to < 0 || to >= groups.length) return exercises;
  return moveGroupTo(exercises, from, to);
}

/** Swaps two members inside a superset, by their place in it */
export function moveWithinSuperset(
  exercises: WorkoutExercise[],
  id: SupersetId,
  fromIdx: number,
  toIdx: number,
): WorkoutExercise[] {
  const positions: number[] = [];
  exercises.forEach((e, i) => {
    if (e.superset_id === id) positions.push(i);
  });
  const isOutside = (i: number) => i < 0 || i >= positions.length;
  if (isOutside(fromIdx) || isOutside(toIdx)) return exercises;
  const a = positions[fromIdx];
  const b = positions[toIdx];
  const next = [...exercises];
  next[a] = exercises[b];
  next[b] = exercises[a];
  return next;
}

export interface SupersetSummary {
  id: SupersetId;
  names: string[];
}

export function existingSupersets(
  exercises: WorkoutExercise[],
): SupersetSummary[] {
  const map = new Map<SupersetId, string[]>();
  for (const exercise of exercises) {
    if (exercise.superset_id == null || !isInSuperset(exercise)) continue;
    const names = map.get(exercise.superset_id) ?? [];
    names.push(exercise.exercise_name ?? "");
    map.set(exercise.superset_id, names);
  }
  return [...map.entries()].map(([id, names]) => ({ id, names }));
}

interface NumberedSet extends WorkoutSet {
  number: number;
}

/** Working sets with their round: `number`, or their position + 1 */
export function numberedWorkingSets(exercise: WorkoutExercise): NumberedSet[] {
  let auto = 0;
  return (exercise.sets ?? [])
    .filter((set) => !set.warmup)
    .map((set) => {
      auto += 1;
      return { ...set, number: set.number ?? auto };
    });
}

/**
 * Does completing a set of `next` (at `idx`) close a round, so the rest
 * timer starts? A single exercise always; a superset once every member that
 * has a set of the just-finished round has it completed.
 */
export function shouldStartRest(
  exercises: WorkoutExercise[],
  idx: number,
  next: WorkoutExercise,
): boolean {
  const id = next.superset_id;
  if (id == null || !isInSuperset(next)) return true;
  const group = exercises
    .map((e, i) => (i === idx ? next : e))
    .filter((e) => e.superset_id === id);
  if (group.length < 2) return true;
  const justCompleted = [...numberedWorkingSets(next)]
    .reverse()
    .find((set) => set.completed);
  if (!justCompleted) return false;
  const round = justCompleted.number;
  return group.every((e) => {
    const inRound = numberedWorkingSets(e).filter((s) => s.number === round);
    return inRound.length === 0 || inRound.every((s) => s.completed);
  });
}

/** Who is up after the rest: the same exercise, or a superset's first member */
export function nextAfterRest(
  exercises: WorkoutExercise[],
  idx: number,
  next: WorkoutExercise,
): WorkoutExercise {
  if (next.superset_id == null || !isInSuperset(next)) return next;
  const updated = exercises.map((e, i) => (i === idx ? next : e));
  return updated.find((e) => e.superset_id === next.superset_id) ?? next;
}

export interface CurrentStatus {
  /** Exercise name, or up to two superset member names */
  names: string[];
  setNumber: number;
  setCount: number;
  anchorIdx: number;
  isSuperset: boolean;
}

/** "Now": the first exercise with an open working set */
export function currentStatus(
  exercises: WorkoutExercise[],
): CurrentStatus | null {
  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i];
    const working = (exercise.sets ?? []).filter((s) => !s.warmup);
    if (working.length === 0) continue;
    const done = working.filter((s) => s.completed).length;
    if (done >= working.length) continue;
    const id = exercise.superset_id;
    if (id != null && isInSuperset(exercise)) {
      const names = exercises
        .filter((e) => e.superset_id === id)
        .map((e) => e.exercise_name ?? "")
        .filter(Boolean)
        .slice(0, 2);
      return {
        names,
        setNumber: done + 1,
        setCount: working.length,
        anchorIdx: exercises.findIndex((e) => e.superset_id === id),
        isSuperset: true,
      };
    }
    return {
      names: exercise.exercise_name ? [exercise.exercise_name] : [],
      setNumber: done + 1,
      setCount: working.length,
      anchorIdx: i,
      isSuperset: false,
    };
  }
  return null;
}

/** 1-based working-set number of set `i`; warm-ups don't count */
export function workingSetNumber(sets: WorkoutSet[], i: number): number {
  let n = 0;
  for (let k = 0; k <= i; k++) if (!sets[k]?.warmup) n++;
  return n;
}

/** The first open working set: the one to do next, -1 when none */
export function nextSetIndex(sets: WorkoutSet[]): number {
  return sets.findIndex((set) => !set.warmup && !set.completed);
}

/**
 * Replaces set `setIdx`. A changed round number shifts every later working
 * set by the same delta (kept within 1..8); clearing it clears theirs.
 */
export function updateSetInList(
  sets: WorkoutSet[],
  setIdx: number,
  set: WorkoutSet,
): WorkoutSet[] {
  const updated = [...sets];
  const old = sets[setIdx];
  updated[setIdx] = set;
  const isNumberChanged = old.number !== set.number && !old.warmup;
  if (!isNumberChanged) return updated;
  if (set.number != null) {
    let position = 0;
    for (let i = 0; i < setIdx; i++) if (!sets[i]?.warmup) position++;
    const delta = set.number - (position + 1);
    if (delta === 0) return updated;
    let workPosition = position;
    for (let i = setIdx + 1; i < updated.length; i++) {
      const later = updated[i];
      if (later.warmup) continue;
      workPosition++;
      const number = workPosition + 1 + delta;
      if (number >= 1 && number <= 8) updated[i] = { ...later, number };
    }
    return updated;
  }
  for (let i = setIdx + 1; i < updated.length; i++) {
    const later = updated[i];
    if (later.warmup || later.number == null) continue;
    const rest = { ...later };
    delete rest.number;
    updated[i] = rest;
  }
  return updated;
}
