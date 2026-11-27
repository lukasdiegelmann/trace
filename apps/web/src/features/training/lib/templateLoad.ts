/**
 * How exercises come into a diary day: from a template (with the weeks
 * matrix of a periodised program and per-set specs), from a recent workout,
 * from yesterday, or one picked from the library. Ported from LiftTrace
 * `routes/Diary.svelte` (`resolveWeek`, `loadTemplate`, `quickLoad`,
 * `addExercise`, `copyFromYesterday`, `suggestedWorkoutName`) and
 * `components/diary/ExerciseCard.svelte` (progression nudge).
 */
import {
  defaultSetTypeForName,
  fmtSetDuration,
  generateWarmupSets,
  parseDuration,
} from "./workout";
import type {
  LastSession,
  LoadType,
  SetType,
  WorkoutExercise,
  WorkoutSet,
} from "./workoutTypes";

export interface EffectiveWeek {
  sets: number | null | undefined;
  reps: string | number | null | undefined;
  weight: string | number | null | undefined;
  duration: string | number | null | undefined;
  tempo: string | null | undefined;
  rest_sec: number | null | undefined;
}

/** This week's prescription: `weeks[week-1]` over the flat targets */
export function resolveWeek(
  exercise: WorkoutExercise,
  week: number | null | undefined,
): EffectiveWeek {
  const base: EffectiveWeek = {
    sets: exercise.target_sets,
    reps: exercise.target_reps,
    weight: exercise.target_weight,
    duration: exercise.target_duration,
    tempo: exercise.tempo,
    rest_sec: exercise.rest_sec,
  };
  if (!week || !exercise.weeks?.length) return base;
  const w = exercise.weeks[week - 1];
  if (!w) return base;
  return {
    sets: w.sets ?? base.sets,
    reps: w.reps ?? base.reps,
    weight: w.weight ?? base.weight,
    duration: w.duration ?? base.duration,
    tempo: w.tempo ?? base.tempo,
    rest_sec: w.rest_sec ?? base.rest_sec,
  };
}

const float = (v: unknown) => parseFloat(String(v));
const int = (v: unknown) => parseInt(String(v), 10);

/**
 * One template exercise as logged sets. `lastAll` is the last session's
 * completed sets, warm-ups included (null: no history or auto-fill off).
 * Inside the active program's week (`planWeek` with a weeks matrix) the plan
 * wins over last session's weights.
 */
export function templateExerciseToLog(
  exercise: WorkoutExercise,
  lastAll: WorkoutSet[] | null,
  planWeek: number | null,
): WorkoutExercise {
  const lastSets = lastAll ? lastAll.filter((s) => !s.warmup) : null;
  const lastWarmups = lastAll ? lastAll.filter((s) => s.warmup) : [];
  const week = resolveWeek(exercise, planWeek);
  const isPlanWeek = !!(planWeek && exercise.weeks?.length);
  const isTimed = exercise.set_type === "time";
  let sets: WorkoutSet[];
  if (exercise.set_specs && exercise.set_specs.length > 0) {
    let workIdx = 0;
    let warmIdx = 0;
    sets = exercise.set_specs.map((spec) => {
      const past = spec.warmup ? lastWarmups[warmIdx++] : lastSets?.[workIdx++];
      const weight = float(spec.weight);
      const reps = int(spec.reps);
      const repsL = int(spec.reps_l);
      const repsR = int(spec.reps_r);
      const set: WorkoutSet = {
        weight: Number.isFinite(weight) ? weight : (past?.weight ?? 0),
        reps: Number.isFinite(reps) ? reps : (past?.reps ?? 0),
        completed: false,
        notes: "",
      };
      if (isTimed) {
        const duration =
          parseDuration(spec.duration) ?? past?.duration_sec ?? 0;
        if (duration) set.duration_sec = duration;
      }
      if (spec.number != null) set.number = spec.number;
      if (spec.warmup) set.warmup = true;
      if (spec.rpe != null) set.rpe = spec.rpe;
      if (Number.isFinite(repsL)) set.reps_l = repsL;
      if (Number.isFinite(repsR)) set.reps_r = repsR;
      return set;
    });
  } else {
    const count = week.sets || 1;
    const planWeight = float(week.weight);
    const planReps = int(week.reps);
    const baseWeight = Number.isFinite(planWeight) ? planWeight : 0;
    const baseReps = Number.isFinite(planReps) ? planReps : 0;
    const last = lastSets?.[lastSets.length - 1];
    if (lastSets && !isPlanWeek) {
      sets = Array.from({ length: count }, (_, i) => ({
        weight: lastSets[i]?.weight ?? last?.weight ?? baseWeight,
        reps: lastSets[i]?.reps ?? last?.reps ?? baseReps,
        completed: false,
        notes: "",
      }));
    } else {
      sets = Array.from({ length: count }, () => ({
        weight: baseWeight,
        reps: baseReps,
        completed: false,
        notes: "",
      }));
    }
    if (isTimed) {
      const planned = parseDuration(week.duration) ?? 0;
      sets = sets.map((set, i) => {
        const fromLast =
          lastSets && !isPlanWeek
            ? (lastSets[i]?.duration_sec ?? last?.duration_sec)
            : null;
        const duration = fromLast || planned;
        return duration ? { ...set, duration_sec: duration } : set;
      });
    }
  }
  return { ...exercise, tempo: week.tempo, rest_sec: week.rest_sec, sets };
}

/**
 * The auto warm-up ramp in front of each exercise with a working weight;
 * never for a timed exercise.
 */
export function withAutoWarmups(
  exercises: WorkoutExercise[],
  unit: string,
): WorkoutExercise[] {
  return exercises.map((exercise) => {
    const sets = exercise.sets ?? [];
    if (
      exercise.set_type === "time" ||
      sets.some((s) => Number(s.duration_sec) > 0)
    ) {
      return exercise;
    }
    const firstWorking = sets.find((s) => !s.warmup);
    const weight =
      float(firstWorking?.weight || exercise.target_weight || 0) || 0;
    const warmups = generateWarmupSets(weight, unit);
    if (warmups.length === 0) return exercise;
    return { ...exercise, sets: [...warmups, ...sets] };
  });
}

/**
 * A recent workout's exercise loaded again: its shape (warm-ups and number
 * of working sets) with the last session's working values (issue #103).
 */
export function quickLoadExercise(
  exercise: WorkoutExercise,
  lastSets: WorkoutSet[] | null,
): WorkoutExercise {
  const own = exercise.sets ?? [];
  const count =
    own.filter((s) => !s.warmup).length || exercise.target_sets || 3;
  const warmups: WorkoutSet[] = own
    .filter((s) => s.warmup)
    .map((s) => ({
      weight: lastSets ? (s.weight ?? 0) : 0,
      reps: lastSets ? (s.reps ?? 0) : 0,
      completed: false,
      notes: "",
      warmup: true,
    }));
  const working: WorkoutSet[] = Array.from({ length: count }, (_, i) => {
    if (!lastSets) return { weight: 0, reps: 0, completed: false, notes: "" };
    // Past the last session's sets, its last one repeats
    const source: WorkoutSet = lastSets.at(i) ?? lastSets.at(-1) ?? {};
    const set: WorkoutSet = {
      weight: source.weight ?? 0,
      reps: source.reps ?? 0,
      completed: false,
      notes: "",
    };
    if (source.duration_sec) set.duration_sec = source.duration_sec;
    return set;
  });
  const sets = [...warmups, ...working];
  const isTimedExercise =
    exercise.set_type === "time" || own.some((s) => Number(s.duration_sec) > 0);
  return isTimedExercise
    ? { ...exercise, set_type: "time", sets }
    : { ...exercise, sets };
}

/** Yesterday's exercises for today: nothing done, reps cleared, weights kept */
export function copiedExercises(
  exercises: WorkoutExercise[],
): WorkoutExercise[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: (exercise.sets ?? []).map((set) => ({
      ...set,
      completed: false,
      reps: 0,
      weight: set.weight ?? 0,
    })),
  }));
}

export interface LibraryExercise {
  id: number;
  name: string;
  /** As the library stores it; anything but "reps"/"time" counts as unset */
  set_type?: string | null;
  category?: string | null;
}

/**
 * An exercise picked from the library, as a new diary entry: last session
 * repeated as it was (warm-ups kept as warm-ups), else one empty set.
 */
export function newDiaryExercise(
  picked: LibraryExercise,
  lastAll: WorkoutSet[] | null,
  loadTypePrefs: Record<string, LoadType | undefined> | null,
  setTypePrefs: Record<string, SetType | undefined> | null,
): WorkoutExercise {
  let sets: WorkoutSet[];
  let targetSets: number;
  let targetReps: string;
  let targetWeight: string;
  if (lastAll) {
    sets = lastAll.map((s) => {
      const set: WorkoutSet = {
        reps: s.reps ?? 0,
        weight: s.weight ?? 0,
        completed: false,
      };
      if (s.duration_sec) set.duration_sec = s.duration_sec;
      if (s.warmup) set.warmup = true;
      return set;
    });
    const working = lastAll.filter((s) => !s.warmup);
    targetSets = working.length;
    targetReps = String(working[0]?.reps || 10);
    targetWeight = String(working[0]?.weight || "");
  } else {
    sets = [{ reps: 0, weight: 0, completed: false }];
    targetSets = 3;
    targetReps = "10";
    targetWeight = "";
  }
  const savedLoadType = loadTypePrefs?.[String(picked.id)];
  const isLastTimed = !!lastAll?.some((s) => Number(s.duration_sec) > 0);
  const isLastReps = !!lastAll?.some((s) => Number(s.reps) > 0);
  const remembered = setTypePrefs?.[String(picked.id)];
  const isTimed =
    isLastTimed ||
    (!isLastReps &&
      (picked.set_type === "time" ||
        (picked.set_type !== "reps" &&
          (remembered === "time" ||
            (remembered !== "reps" &&
              defaultSetTypeForName(picked.name) === "time")))));
  if (isTimed) targetReps = "";
  return {
    exercise_id: picked.id,
    exercise_name: picked.name,
    target_sets: targetSets,
    target_reps: targetReps,
    target_weight: targetWeight,
    notes: "",
    sets,
    ...(savedLoadType && savedLoadType !== "bilateral"
      ? { load_type: savedLoadType }
      : {}),
    ...(isTimed ? { set_type: "time" as const } : {}),
  };
}

/** Inserts behind a superset's last member (or at the end) */
export function insertExercise(
  exercises: WorkoutExercise[],
  exercise: WorkoutExercise,
  supersetId: string | number | null,
): WorkoutExercise[] {
  if (supersetId == null) return [...exercises, exercise];
  let at = exercises.length;
  for (let i = exercises.length - 1; i >= 0; i--) {
    if (exercises[i]?.superset_id === supersetId) {
      at = i + 1;
      break;
    }
  }
  return [
    ...exercises.slice(0, at),
    { ...exercise, superset_id: supersetId },
    ...exercises.slice(at),
  ];
}

export type SuggestedName =
  | { kind: "push" | "pull" | "legs" | "arms" | "upper" | "full" | "workout" }
  | { kind: "category"; category: string };

/** A default name from the exercises' categories (auto-name) */
export function suggestedWorkoutName(
  exercises: WorkoutExercise[],
): SuggestedName | null {
  if (!exercises.length) return null;
  const categories = new Set(
    exercises.map((e) => (e.category ?? "").toLowerCase()).filter(Boolean),
  );
  const has = (c: string) => categories.has(c);
  if (has("chest") && has("shoulders") && !has("back")) return { kind: "push" };
  if (has("back") && (has("biceps") || has("arms")) && !has("chest")) {
    return { kind: "pull" };
  }
  if (
    (has("legs") || has("quadriceps") || has("hamstrings") || has("glutes")) &&
    categories.size <= 2
  ) {
    return { kind: "legs" };
  }
  if (has("arms") || (has("biceps") && has("triceps"))) return { kind: "arms" };
  if (has("chest") && has("back")) return { kind: "upper" };
  if (categories.size >= 4) return { kind: "full" };
  const [first] = categories;
  return first
    ? {
        kind: "category",
        category: first.charAt(0).toUpperCase() + first.slice(1),
      }
    : { kind: "workout" };
}

export interface ProgressionSuggestion {
  weight: number;
  step: number;
}

/**
 * Last session hit the target reps on every set: suggest one plate step
 * more (5 lb / 2.5 kg) than its heaviest set. Never for a timed exercise.
 */
export function progressionSuggestion(
  exercise: WorkoutExercise,
  last: Pick<LastSession, "completed"> | null,
  unit: string,
  isTimed: boolean,
): ProgressionSuggestion | null {
  if (isTimed || !last || !exercise.target_reps) return null;
  const target = int(String(exercise.target_reps).split(/[-–]/)[0]);
  if (!Number.isFinite(target)) return null;
  const sets = last.completed;
  if (!sets.length || !sets.every((s) => (int(s.reps) || 0) >= target)) {
    return null;
  }
  const lastWeight = Math.max(...sets.map((s) => float(s.weight) || 0));
  if (!lastWeight) return null;
  const step = unit === "kg" ? 2.5 : 5;
  return { weight: lastWeight + step, step };
}

/** Volume change against last time in whole percent, null without both */
export function volumeDeltaPct(current: number, last: number): number | null {
  if (last > 0 && current > 0) {
    return Math.round(((current - last) / last) * 100);
  }
  return null;
}

/** One template row's target for the preview: "3×8 @ 100kg", "3×1:00" */
export function templateTarget(
  exercise: WorkoutExercise,
  unit: string,
  repsOnly: (reps: string) => string,
): string {
  if (exercise.set_type === "time") {
    const time = (v: string | number | null | undefined) =>
      fmtSetDuration(parseDuration(v)) || "-";
    if (exercise.set_specs?.length) {
      return exercise.set_specs
        .map((s) =>
          s.weight
            ? `${time(s.duration)} @ ${s.weight}${unit}`
            : time(s.duration),
        )
        .join(", ");
    }
    const weight = exercise.target_weight
      ? ` @ ${exercise.target_weight}${unit}`
      : "";
    return `${exercise.target_sets || 1}×${time(exercise.target_duration)}${weight}`;
  }
  if (exercise.set_specs?.length) {
    return exercise.set_specs
      .map((s) => {
        const reps = s.reps ? String(s.reps) : "—";
        return s.weight ? `${reps}×${s.weight}${unit}` : repsOnly(reps);
      })
      .join(", ");
  }
  const reps = exercise.target_reps ? String(exercise.target_reps) : "—";
  const head = `${exercise.target_sets || 1}×${reps}`;
  return exercise.target_weight
    ? `${head} @ ${exercise.target_weight}${unit}`
    : head;
}
