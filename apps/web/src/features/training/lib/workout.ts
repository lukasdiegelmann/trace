import { toText } from "./searchText";

/**
 * Workout calculations, after backends/lifttrace/src/lib/workout.js (the
 * mirror of server/lib/volume.js). Shared by every training screen.
 */

export type LoadType = "bilateral" | "paired" | "unilateral";
export type SetType = "reps" | "time";

/** A logged set as the backend stores it (workout_log.exercises[].sets[]) */
export interface WorkoutSet {
  weight?: number | string | null;
  reps?: number | string | null;
  reps_l?: number | string | null;
  reps_r?: number | string | null;
  duration_sec?: number | string | null;
  completed?: boolean | number | null;
  warmup?: boolean | number | null;
  rpe?: number | null;
  notes?: string | null;
  uuid?: string;
}

/** A workout-instance exercise */
export interface WorkoutExercise {
  exercise_id?: number | null;
  exercise_name?: string | null;
  load_type?: string | null;
  set_type?: string | null;
  sets?: WorkoutSet[];
}

/**
 * Which load_type applies: per-instance override, library default (only
 * when set), the user's remembered choice, else bilateral.
 */
export function resolveLoadType(
  exercise: WorkoutExercise | null | undefined,
  libraryLoadType?: string | null,
  clientPrefs?: Record<string, string | undefined> | null,
): LoadType {
  if (exercise?.load_type) return exercise.load_type as LoadType;
  if (libraryLoadType) return libraryLoadType as LoadType;
  const id = exercise?.exercise_id;
  const pref = id != null ? clientPrefs?.[id] : undefined;
  return (pref as LoadType | undefined) || "bilateral";
}

export const SET_TYPES: SetType[] = ["reps", "time"];

function cleanSetType(value: unknown): SetType | null {
  return value === "time" || value === "reps" ? value : null;
}

/** Timed for all math: an explicit set_type wins, else a duration on the set */
export function isTimedSet(
  exercise: { set_type?: string | null } | null | undefined,
  set: WorkoutSet | null | undefined,
): boolean {
  const type = cleanSetType(exercise?.set_type);
  if (type) return type === "time";
  return Number(set?.duration_sec) > 0;
}

/** Exercises timed by nature, matched by exact normalised name */
const TIMED_BY_NAME = new Set([
  "plank",
  "side plank",
  "side bridge",
  "copenhagen plank",
  "wall sit",
  "dead hang",
  "bar hang",
  "one handed hang",
  "flexed arm hang",
  "hollow hold",
  "hollow body hold",
  "l sit",
  "farmers walk",
  "farmer walk",
  "farmers carry",
  "suitcase carry",
  "rickshaw carry",
]);

export function defaultSetTypeForName(name: unknown): SetType | null {
  const key = toText(name)
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return TIMED_BY_NAME.has(key) ? "time" : null;
}

/** Which input an exercise shows: instance, data, library, pref, name, reps */
export function resolveSetType(
  exercise: WorkoutExercise | null | undefined,
  librarySetType?: string | null,
  clientPrefs?: Record<string, string | undefined> | null,
): SetType {
  const own = cleanSetType(exercise?.set_type);
  if (own) return own;
  const sets = exercise?.sets ?? [];
  if (sets.some((set) => Number(set.duration_sec) > 0)) return "time";
  if (sets.some((set) => Number(set.reps) > 0)) return "reps";
  const library = cleanSetType(librarySetType);
  if (library) return library;
  const id = exercise?.exercise_id;
  const pref = clientPrefs && id != null ? cleanSetType(clientPrefs[id]) : null;
  return pref ?? defaultSetTypeForName(exercise?.exercise_name) ?? "reps";
}

/** 75 -> "1:15", 45 -> "0:45", 3725 -> "1:02:05"; "" for no duration */
export function fmtSetDuration(seconds: unknown): string {
  const n = Math.round(Number(seconds));
  if (!Number.isFinite(n) || n <= 0) return "";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const ss = String(n % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const UNIT_DURATION =
  /^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes))?\s*(?:(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds))?$/;

/**
 * A typed duration in whole seconds, or null. Bare digits fill from the
 * right like a microwave: "130" -> 90; "1:30", "0:90", "45s", "2m", "1m30s".
 */
export function parseDuration(input: unknown): number | null {
  if (input == null) return null;
  const str = toText(input).trim().toLowerCase();
  if (!str) return null;
  if (/^\d+:\d{1,2}$/.test(str)) {
    const [m = 0, s = 0] = str.split(":").map(Number);
    const total = m * 60 + s;
    return total > 0 ? total : null;
  }
  if (/^\d+:\d{1,2}:\d{1,2}$/.test(str)) {
    const [h = 0, m = 0, s = 0] = str.split(":").map(Number);
    if (m >= 60 || s >= 60) return null;
    const total = h * 3600 + m * 60 + s;
    return total > 0 ? total : null;
  }
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    const total = Math.floor(n / 100) * 60 + (n % 100);
    return total > 0 ? total : null;
  }
  const match = UNIT_DURATION.exec(str);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  const total = Math.round(
    (Number(match[1]) || 0) * 3600 +
      (Number(match[2]) || 0) * 60 +
      (Number(match[3]) || 0),
  );
  return total > 0 ? total : null;
}

/** Timer-style live display while typing: "1" 0:01, "130" 1:30 */
export function maskDurationInput(raw: unknown): string {
  const digits = toText(raw).replace(/\D/g, "").replace(/^0+/, "").slice(0, 4);
  if (!digits) return "";
  const n = Number(digits);
  return `${Math.floor(n / 100)}:${String(n % 100).padStart(2, "0")}`;
}

/** "135×8", "25×1:00" for a weighted hold, "1:00" for a bodyweight one */
export function fmtSetLabel(
  exercise: { set_type?: string | null } | null | undefined,
  set: WorkoutSet | null | undefined,
): string {
  if (!set) return "";
  if (isTimedSet(exercise, set)) {
    const time = fmtSetDuration(set.duration_sec) || "0:00";
    return set.weight ? `${String(set.weight)}×${time}` : time;
  }
  return `${String(set.weight || 0)}×${String(set.reps || 0)}`;
}

/** Volume of one set by load type (warm-ups are the caller's job) */
export function setVolume(
  set: WorkoutSet | null | undefined,
  loadType: string = "bilateral",
): number {
  if (!set) return 0;
  const weight = Number(set.weight) || 0;
  if (weight <= 0) return 0;
  if (loadType === "unilateral") {
    if (set.reps_l != null || set.reps_r != null) {
      return weight * ((Number(set.reps_l) || 0) + (Number(set.reps_r) || 0));
    }
    return weight * (Number(set.reps) || 0) * 2;
  }
  if (loadType === "paired") return weight * (Number(set.reps) || 0) * 2;
  return weight * (Number(set.reps) || 0);
}

/** Completed working sets, not timed, by the resolved load type */
export function exerciseVolume(
  exercise: WorkoutExercise | null | undefined,
  options: {
    libraryLoadType?: string | null;
    clientPrefs?: Record<string, string | undefined> | null;
  } = {},
): number {
  if (!exercise) return 0;
  const loadType = resolveLoadType(
    exercise,
    options.libraryLoadType,
    options.clientPrefs,
  );
  let total = 0;
  for (const set of exercise.sets ?? []) {
    if (!set.completed || set.warmup) continue;
    if (isTimedSet(exercise, set)) continue;
    total += setVolume(set, loadType);
  }
  return total;
}

export function calcVolume(
  exercises: WorkoutExercise[] | null | undefined,
): number {
  if (!exercises?.length) return 0;
  return exercises.reduce((sum, exercise) => sum + exerciseVolume(exercise), 0);
}

export interface HistoryEntry {
  date: string;
  sets?: WorkoutSet[];
  set_type?: string | null;
  notes?: string | null;
}

/** Newest session (before `before`) with a completed working set */
export function lastCompletedSession<E extends Partial<HistoryEntry>>(
  history: E[] | null | undefined,
  { before }: { before?: string } = {},
) {
  for (const entry of history ?? []) {
    if (before && !(typeof entry.date === "string" && entry.date < before)) {
      continue;
    }
    const sets: NonNullable<E["sets"]>[number][] = entry.sets ?? [];
    // Every completed set (the Last Time row) and the working ones among
    // them (what auto-fill copies)
    const completed = sets.filter((set) => set.completed);
    const working = completed.filter((set) => !set.warmup);
    if (working.length) return { ...entry, completed, working };
  }
  return null;
}

/** Epley: w × (1 + r/30), rounded; 1 rep is the weight itself */
export function calc1RM(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export interface CalorieProfile {
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  sex?: string | null;
}

/** Mifflin-St Jeor BMR × MET (5, 6 when ≥ 200 volume/min); null if unknown */
export function estimateWorkoutCalories(
  workout: { exercises?: WorkoutExercise[]; duration_min?: number | null },
  profile: CalorieProfile | null | undefined,
): number | null {
  if (!profile) return null;
  const { weight_kg: weightKg, height_cm: heightCm, age, sex } = profile;
  if (!weightKg || !heightCm || !age) return null;
  let minutes = workout.duration_min ?? 0;
  if (minutes <= 0) {
    const workingSets = (workout.exercises ?? []).reduce(
      (sum, exercise) =>
        sum +
        (exercise.sets ?? []).filter((set) => set.completed && !set.warmup)
          .length,
      0,
    );
    if (workingSets <= 0) return null;
    minutes = workingSets * 3;
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr =
    sex === "male" ? base + 5 : sex === "female" ? base - 161 : base - 78;
  const intensity = calcVolume(workout.exercises) / minutes;
  const met = intensity >= 200 ? 6 : 5;
  return Math.max(0, Math.round((bmr / 24) * met * (minutes / 60)));
}

export function toKg(
  weight: number | null | undefined,
  unit: string,
): number | null {
  if (weight == null) return null;
  return unit === "kg" ? weight : weight * 0.45359237;
}

export function cmToFtIn(cm: number | null | undefined): {
  ft: number | "";
  in: number | "";
} {
  if (cm == null) return { ft: "", in: "" };
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - ft * 12);
  if (inches === 12) return { ft: ft + 1, in: 0 };
  return { ft, in: inches };
}

export function ftInToCm(ft: unknown, inches: unknown): number {
  return Math.round(((Number(ft) || 0) * 12 + (Number(inches) || 0)) * 2.54);
}

export function ageFromDob(
  dob: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dob) return null;
  const date = new Date(`${dob}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  let age = now.getFullYear() - date.getFullYear();
  const months = now.getMonth() - date.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < date.getDate())) age--;
  return age;
}

export interface SetCount {
  completed: number;
  total: number;
}

export function countCompletedSets(
  exercises: WorkoutExercise[] | null | undefined,
): SetCount {
  let completed = 0;
  let total = 0;
  for (const exercise of exercises ?? []) {
    for (const set of exercise.sets ?? []) {
      total++;
      if (set.completed) completed++;
    }
  }
  return { completed, total };
}

/** One decimal, ".0" hidden: "102.5 kg", "100 lbs"; "—" for none */
export function fmtWeight(weight: number | null | undefined, unit = "lbs") {
  if (!weight && weight !== 0) return "—";
  const rounded = Math.round(weight * 10) / 10;
  return `${rounded % 1 === 0 ? Math.round(rounded) : rounded} ${unit}`;
}

/** Minutes as "45m", "1h 5m", "2h"; "—" for none */
export function fmtDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Category ids; labels are i18n keys `categories.<id>` */
export const CATEGORIES = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "cardio",
  "full_body",
  "other",
] as const;
export type CategoryId = (typeof CATEGORIES)[number];

/** Equipment as stored (English values, shown translated where known) */
export const EQUIPMENT = [
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Bodyweight",
  "Kettlebell",
  "Smith Machine",
  "Other",
] as const;

export interface WarmupSet {
  weight: number;
  reps: number;
  /* eslint-disable @typescript-eslint/naming-convention -- the backend's keys */
  completed: boolean;
  warmup: boolean;
  /* eslint-enable @typescript-eslint/naming-convention */
  notes: string;
}

/** Bar × 8 → 50% × 5 → 70% × 3 → 85% × 2, rounded to 2.5 kg / 5 lbs */
export function generateWarmupSets(
  workingWeight: unknown,
  unit = "lbs",
): WarmupSet[] {
  const working = parseFloat(String(workingWeight)) || 0;
  const bar = unit === "kg" ? 20 : 45;
  const step = unit === "kg" ? 2.5 : 5;
  const roundTo = (n: number) => Math.round(n / step) * step;
  if (working <= bar) return [];
  const base = { completed: false, warmup: true, notes: "" };
  const sets: WarmupSet[] = [{ ...base, weight: bar, reps: 8 }];
  const p50 = roundTo(working * 0.5);
  if (p50 > bar) sets.push({ ...base, weight: p50, reps: 5 });
  const p70 = roundTo(working * 0.7);
  if (p70 > p50) sets.push({ ...base, weight: p70, reps: 3 });
  const p85 = roundTo(working * 0.85);
  if (p85 > p70) sets.push({ ...base, weight: p85, reps: 2 });
  return sets;
}

/** Canonical muscle values of the exercise editor (stored lowercase) */
export const MUSCLES = [
  "chest",
  "lats",
  "upper back",
  "lower back",
  "shoulders",
  "front delts",
  "side delts",
  "rear delts",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "neck",
  "traps",
] as const;

/** Program goal ids; labels are i18n keys `goals.<id>` */
export const GOALS = [
  "cutting",
  "bulking",
  "maintenance",
  "strength",
  "endurance",
  "general",
] as const;
export type GoalId = (typeof GOALS)[number];
