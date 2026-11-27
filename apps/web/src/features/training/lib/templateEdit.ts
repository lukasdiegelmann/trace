/**
 * The workout (template) editor's edits, ported from LiftTrace
 * `routes/WorkoutEditor.svelte`. All functions are pure: they return new
 * arrays and never change the exercises they get.
 */
import type { LibraryExercise } from "./templateLoad";
import {
  createSuperset,
  isInSuperset,
  joinSuperset,
  leaveSuperset,
  moveExercise,
  newSupersetId,
  recalcSuperset,
  type SupersetId,
} from "./supersets";
import {
  defaultSetTypeForName,
  parseDuration,
  resolveLoadType,
  resolveSetType,
} from "./workout";
import type {
  LoadType,
  SetSpec,
  SetType,
  WeekSpec,
  WorkoutExercise,
} from "./workoutTypes";

export { leaveSuperset };

type Exercises = WorkoutExercise[];

/** The editor's own view of a template exercise: the server's library fields */
interface EnrichedExercise extends WorkoutExercise {
  exercise_load_type?: LoadType | null;
  exercise_set_type?: SetType | null;
}

/** The entry at `idx`, undefined outside the list */
function entryAt(
  exercises: Exercises,
  idx: number,
): WorkoutExercise | undefined {
  return idx >= 0 && idx < exercises.length ? exercises[idx] : undefined;
}

/** A copy without `keys` */
function omit<T extends object, K extends keyof T>(
  value: T,
  ...keys: K[]
): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;
}

function replaceAt(
  exercises: Exercises,
  idx: number,
  change: (exercise: WorkoutExercise) => WorkoutExercise,
): Exercises {
  return exercises.map((e, i) => (i === idx ? change(e) : e));
}

// ── Order, removal, supersets ──────────────────────────────────────────────

/**
 * One step up or down. Inside a superset the members swap; at its edge the
 * whole block moves; a single exercise steps over a whole superset, so no
 * move ever splits one. Returns the same array when there is no room.
 */
export function moveEditorExercise(
  exercises: Exercises,
  idx: number,
  direction: -1 | 1,
): Exercises {
  const exercise = entryAt(exercises, idx);
  const neighbour = entryAt(exercises, idx + direction);
  if (
    exercise &&
    neighbour &&
    isInSuperset(exercise) &&
    neighbour.superset_id === exercise.superset_id
  ) {
    const next = [...exercises];
    next[idx] = neighbour;
    next[idx + direction] = exercise;
    const id = exercise.superset_id;
    return id == null ? next : recalcSuperset(next, id);
  }
  return moveExercise(exercises, idx, direction);
}

export function removeExercise(exercises: Exercises, idx: number): Exercises {
  const removed = entryAt(exercises, idx);
  if (!removed) return exercises;
  const rest = exercises.filter((_, i) => i !== idx);
  return removed.superset_id != null
    ? recalcSuperset(rest, removed.superset_id)
    : rest;
}

/** Joins the superset, behind its last member, and takes its number of sets */
export function addToSuperset(
  exercises: Exercises,
  idx: number,
  id: SupersetId,
): Exercises {
  const groupSets = exercises.find(
    (e, i) => i !== idx && e.superset_id === id,
  )?.target_sets;
  const next = joinSuperset(exercises, idx, id);
  const joinedAt = next.map((e) => e.superset_id).lastIndexOf(id);
  const joined = entryAt(next, joinedAt);
  // Per-set targets keep their own count
  if (!groupSets || !joined || joined.set_specs?.length) return next;
  return replaceAt(next, joinedAt, (e) => ({ ...e, target_sets: groupSets }));
}

/** A new superset; everyone gets the first member's number of sets */
export function startSuperset(
  exercises: Exercises,
  indices: number[],
  id: SupersetId = newSupersetId(),
): Exercises {
  if (indices.length < 2) return exercises;
  const sets = exercises[Math.min(...indices)]?.target_sets || 3;
  return createSuperset(exercises, indices, id).map((e) =>
    e.superset_id === id && !e.set_specs?.length
      ? { ...e, target_sets: sets }
      : e,
  );
}

export function dissolveSuperset(
  exercises: Exercises,
  id: SupersetId,
): Exercises {
  return exercises.map((exercise) =>
    exercise.superset_id === id
      ? omit(exercise, "superset_id", "superset_size", "superset_position")
      : exercise,
  );
}

/** All of `source` joins `target`, as one run where the first member stands */
export function mergeSupersets(
  exercises: Exercises,
  source: SupersetId,
  target: SupersetId,
): Exercises {
  if (source === target) return exercises;
  const moved = exercises.map((e) =>
    e.superset_id === source ? { ...e, superset_id: target } : e,
  );
  const first = moved.findIndex((e) => e.superset_id === target);
  if (first < 0) return exercises;
  const members = moved.filter((e) => e.superset_id === target);
  const before = moved.slice(0, first);
  const after = moved.slice(first).filter((e) => e.superset_id !== target);
  return recalcSuperset([...before, ...members, ...after], target);
}

// ── Adding and replacing ───────────────────────────────────────────────────

/**
 * A picked exercise as a new template entry: the remembered load type travels
 * with it, and a timed one starts with an empty duration (issue #89).
 */
export function newTemplateExercise(
  picked: LibraryExercise,
  loadTypePrefs: Record<string, LoadType | undefined> | null,
  setTypePrefs: Record<string, SetType | undefined> | null,
): WorkoutExercise {
  const savedLoadType = loadTypePrefs?.[String(picked.id)];
  const remembered = setTypePrefs?.[String(picked.id)];
  const isTimed =
    picked.set_type === "time" ||
    (picked.set_type !== "reps" &&
      (remembered === "time" ||
        (remembered !== "reps" &&
          defaultSetTypeForName(picked.name) === "time")));
  return {
    exercise_id: picked.id,
    exercise_name: picked.name,
    target_sets: 3,
    target_reps: isTimed ? "" : "10",
    target_weight: "",
    notes: "",
    sets: [],
    ...(savedLoadType && savedLoadType !== "bilateral"
      ? { load_type: savedLoadType }
      : {}),
    ...(isTimed ? { set_type: "time" as const, target_duration: "" } : {}),
  };
}

/** Appends the exercise, into a superset when one is given */
export function appendExercise(
  exercises: Exercises,
  exercise: WorkoutExercise,
  supersetId: SupersetId | null,
): Exercises {
  const next = [...exercises, exercise];
  return supersetId == null
    ? next
    : addToSuperset(next, next.length - 1, supersetId);
}

/** The library fields of an entry; they belong to one exercise, never saved */
const LIBRARY_FIELDS = [
  "_library_load_type",
  "_library_set_type",
  "exercise_load_type",
  "exercise_set_type",
] as const;

/** Another exercise in the same place: targets, notes and superset stay */
export function replaceExercise(
  exercises: Exercises,
  idx: number,
  picked: Pick<LibraryExercise, "id" | "name">,
): Exercises {
  return replaceAt(exercises, idx, (exercise) => ({
    ...omit(exercise as EnrichedExercise, ...LIBRARY_FIELDS),
    exercise_id: picked.id,
    exercise_name: picked.name,
  }));
}

export function forSave(exercises: Exercises): Exercises {
  return exercises.map((exercise) =>
    omit(exercise, "_library_load_type", "_library_set_type"),
  );
}

// ── Load type and tracked-by ───────────────────────────────────────────────

export function templateLoadType(
  exercise: WorkoutExercise,
  prefs: Record<string, LoadType | undefined> | null,
): LoadType {
  const enriched = exercise as EnrichedExercise;
  return resolveLoadType(
    exercise,
    enriched._library_load_type ?? enriched.exercise_load_type ?? null,
    prefs,
  );
}

/**
 * A template has no logged sets, so its prescription stands in as the data:
 * "Plank, 60 reps" keeps showing reps.
 */
export function templateSetType(
  exercise: WorkoutExercise,
  prefs: Record<string, SetType | undefined> | null,
): SetType {
  const enriched = exercise as EnrichedExercise;
  const specs: SetSpec[] = exercise.set_specs?.length
    ? exercise.set_specs
    : [
        {
          reps: exercise.target_reps ?? null,
          duration: exercise.target_duration ?? null,
        },
      ];
  const sets = specs.map((spec) => ({
    reps: parseInt(String(spec.reps), 10) || 0,
    duration_sec: parseDuration(spec.duration) ?? 0,
  }));
  return resolveSetType(
    { ...exercise, sets },
    enriched._library_set_type ?? enriched.exercise_set_type ?? null,
    prefs,
  );
}

// ── Multi-week progression matrix (issue #13) ──────────────────────────────

export type WeekField = keyof WeekSpec;

export const WEEK_FIELDS: WeekField[] = [
  "sets",
  "reps",
  "weight",
  "duration",
  "tempo",
  "rest_sec",
];

const FLAT_FIELD = {
  sets: "target_sets",
  reps: "target_reps",
  weight: "target_weight",
  duration: "target_duration",
  tempo: "tempo",
  rest_sec: "rest_sec",
} as const;

export type WeekValue = string | number;

/**
 * A field's value in a plan week (1-based). Week 1 (or a plan without weeks)
 * reads the flat targets, later weeks `weeks[week - 1]`. "" when unset.
 */
export function fieldFor(
  exercise: WorkoutExercise,
  field: WeekField,
  week: number,
  durationWeeks: number,
): WeekValue {
  if (durationWeeks <= 1 || week === 1) {
    const value = exercise[FLAT_FIELD[field]];
    // 0 sets is how a cleared field is stored
    if (field === "sets" && value === 0) return "";
    return value ?? "";
  }
  return exercise.weeks?.[week - 1]?.[field] ?? "";
}

function weeksUpTo(exercise: WorkoutExercise, week: number) {
  const weeks: (WeekSpec | null)[] = [...(exercise.weeks ?? [])];
  while (weeks.length < week) weeks.push(null);
  return weeks;
}

/**
 * Writes a field for a week. In a later week an empty value removes the key,
 * so the week inherits the exercise's default.
 */
export function setWeekValue(
  exercises: Exercises,
  idx: number,
  field: WeekField,
  value: WeekValue,
  week: number,
  durationWeeks: number,
): Exercises {
  const isEmpty =
    value === "" || (typeof value === "number" && Number.isNaN(value));
  return replaceAt(exercises, idx, (exercise) => {
    if (durationWeeks <= 1 || week === 1) {
      const cleared = field === "sets" ? 0 : field === "rest_sec" ? null : "";
      return { ...exercise, [FLAT_FIELD[field]]: isEmpty ? cleared : value };
    }
    const weeks = weeksUpTo(exercise, week);
    const entry: WeekSpec = weeks[week - 1] ?? {};
    weeks[week - 1] = isEmpty
      ? omit(entry, field)
      : { ...entry, [field]: value };
    return { ...exercise, weeks };
  });
}

function withWeekCopied(
  exercise: WorkoutExercise,
  from: number,
  durationWeeks: number,
): WorkoutExercise {
  const entry: Record<string, unknown> = {};
  for (const field of WEEK_FIELDS) {
    const value = fieldFor(exercise, field, from, durationWeeks);
    if (value !== "") entry[field] = value;
  }
  const weeks = weeksUpTo(exercise, from + 1);
  weeks[from] = entry;
  return { ...exercise, weeks };
}

/** Would copying this week change the next one? */
export function differsFromNext(
  exercise: WorkoutExercise,
  week: number,
  durationWeeks: number,
): boolean {
  if (week >= durationWeeks) return false;
  return WEEK_FIELDS.some(
    (field) =>
      String(fieldFor(exercise, field, week, durationWeeks)) !==
      String(fieldFor(exercise, field, week + 1, durationWeeks)),
  );
}

/** Copies `week` into the next one, for one exercise or (null) for all */
export function copyWeek(
  exercises: Exercises,
  week: number,
  durationWeeks: number,
  idx: number | null = null,
): Exercises {
  if (week >= durationWeeks) return exercises;
  return exercises.map((exercise, i) =>
    idx == null || i === idx
      ? withWeekCopied(exercise, week, durationWeeks)
      : exercise,
  );
}

// ── Per-set targets (e.g. pyramid sets) ────────────────────────────────────

/** The specs, with `target_sets` following their count; none: uniform again */
function withSpecs(
  exercise: WorkoutExercise,
  specs: SetSpec[],
): WorkoutExercise {
  if (specs.length === 0) return omit(exercise, "set_specs");
  return { ...exercise, set_specs: specs, target_sets: specs.length };
}

export function enablePerSet(exercises: Exercises, idx: number): Exercises {
  return replaceAt(exercises, idx, (exercise) => ({
    ...exercise,
    set_specs: Array.from({ length: exercise.target_sets || 3 }, () => ({
      weight: exercise.target_weight || "",
      reps: exercise.target_reps || "",
      ...(exercise.target_duration
        ? { duration: exercise.target_duration }
        : {}),
    })),
  }));
}

export function disablePerSet(exercises: Exercises, idx: number): Exercises {
  return replaceAt(exercises, idx, (exercise) => withSpecs(exercise, []));
}

export function patchSpec(
  exercises: Exercises,
  idx: number,
  setIdx: number,
  patch: Partial<SetSpec>,
): Exercises {
  return replaceAt(exercises, idx, (exercise) =>
    withSpecs(
      exercise,
      (exercise.set_specs ?? []).map((spec, i) =>
        i === setIdx ? { ...spec, ...patch } : spec,
      ),
    ),
  );
}

/**
 * The round number of a spec (asymmetric supersets). A new number shifts
 * every later spec by the same amount; clearing it (null, or its own
 * position) clears the later ones too.
 */
export function setSpecNumber(
  exercises: Exercises,
  idx: number,
  setIdx: number,
  number: number | null,
): Exercises {
  return replaceAt(exercises, idx, (exercise) => {
    const specs = exercise.set_specs ?? [];
    const isCleared = number == null || number === setIdx + 1;
    return withSpecs(
      exercise,
      specs.map((spec, i) => {
        if (i < setIdx) return spec;
        if (isCleared) return omit(spec, "number");
        if (i === setIdx) return { ...spec, number };
        const shifted = i + 1 + (number - (setIdx + 1));
        return shifted >= 1 && shifted <= 99
          ? { ...spec, number: shifted }
          : spec;
      }),
    );
  });
}

export function addSpec(exercises: Exercises, idx: number): Exercises {
  return replaceAt(exercises, idx, (exercise) => {
    const specs = exercise.set_specs ?? [];
    const last = specs[specs.length - 1] ?? { weight: "", reps: "" };
    return withSpecs(exercise, [
      ...specs,
      {
        weight: last.weight ?? "",
        reps: last.reps ?? "",
        ...(last.duration ? { duration: last.duration } : {}),
      },
    ]);
  });
}

export function removeSpec(
  exercises: Exercises,
  idx: number,
  setIdx: number,
): Exercises {
  return replaceAt(exercises, idx, (exercise) =>
    withSpecs(
      exercise,
      (exercise.set_specs ?? []).filter((_, i) => i !== setIdx),
    ),
  );
}

/** Splits a unilateral spec's reps per side, or merges them to the higher */
export function splitPatch(spec: SetSpec): Partial<SetSpec> {
  if (spec.reps_l != null || spec.reps_r != null) {
    const kept = Math.max(
      parseFloat(String(spec.reps_l)) || 0,
      parseFloat(String(spec.reps_r)) || 0,
    );
    return { reps_l: null, reps_r: null, reps: kept || spec.reps || "" };
  }
  const reps = spec.reps || "";
  return { reps_l: reps, reps_r: reps };
}
