/**
 * The muscle map's vocabulary and shading (lib/muscles.js) and the recovery
 * state per muscle group (lib/muscle-recovery.js).
 */
import { isTimedSet, type WorkoutExercise } from "./workout";

/** The 18 drawable muscles, head to toe */
export const MAP_MUSCLES = [
  "trapezius",
  "deltoids",
  "chest",
  "upper-back",
  "serratus",
  "biceps",
  "triceps",
  "forearm",
  "abs",
  "obliques",
  "lower-back",
  "gluteal",
  "quadriceps",
  "hamstring",
  "adductors",
  "hip-flexors",
  "calves",
  "tibialis",
] as const;
export type MapMuscle = (typeof MAP_MUSCLES)[number];

/** Parts drawn as silhouette: they carry no training load */
export const INERT_PARTS = [
  "head",
  "hair",
  "neck",
  "hands",
  "feet",
  "knees",
  "ankles",
] as const;

export type MuscleLoad = Partial<Record<string, number>>;

/** 0–4 per muscle, relative to the hardest-worked one of the same window */
export function levelsOf(load: MuscleLoad): Record<MapMuscle, number> {
  const max = Math.max(0, ...MAP_MUSCLES.map((m) => load[m] ?? 0));
  return Object.fromEntries(
    MAP_MUSCLES.map((muscle) => {
      const value = load[muscle] ?? 0;
      const level =
        !value || max <= 0
          ? 0
          : Math.max(1, Math.min(4, Math.ceil((value / max) * 4)));
      return [muscle, level];
    }),
  ) as Record<MapMuscle, number>;
}

/** Hardest-worked first; the untrained ones in body order */
export function rankOf(load: MuscleLoad): {
  worked: MapMuscle[];
  missed: MapMuscle[];
} {
  return {
    worked: MAP_MUSCLES.filter((m) => (load[m] ?? 0) > 0).sort(
      (a, b) => (load[b] ?? 0) - (load[a] ?? 0),
    ),
    missed: MAP_MUSCLES.filter((m) => !((load[m] ?? 0) > 0)),
  };
}

export const RECOVERY_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;
export type RecoveryGroup = (typeof RECOVERY_GROUPS)[number];

/** A catalog's muscle name as one of the recovery groups, or null */
export function recoveryGroup(name: unknown): RecoveryGroup | null {
  const s = (typeof name === "string" ? name : "").toLowerCase().trim();
  const has = (...parts: string[]) => parts.some((part) => s.includes(part));
  if (has("chest", "pec")) return "chest";
  if (has("back", "lat", "trap", "rhomboid")) return "back";
  if (has("shoulder", "delt", "rotator cuff")) return "shoulders";
  if (has("bicep", "brachialis")) return "biceps";
  if (has("tricep")) return "triceps";
  if (has("forearm", "wrist", "grip")) return "forearms";
  // Before "ab" below: the abductors are hip muscles, not core.
  if (has("abductor")) return "glutes";
  if (has("ab", "core", "obliqu")) return "core";
  if (has("quad")) return "quads";
  if (has("hamstring")) return "hamstrings";
  if (has("glute")) return "glutes";
  if (has("calf", "calve", "gastroc", "soleus")) return "calves";
  return null;
}

export type Freshness =
  "fatigued" | "recovering" | "ready" | "fresh" | "untrained";

/** Under 24 h fatigued, under 48 h recovering, under 72 h ready */
export function freshnessFor(hoursAgo: number | null): Freshness {
  if (hoursAgo === null) return "untrained";
  if (hoursAgo < 24) return "fatigued";
  if (hoursAgo < 48) return "recovering";
  if (hoursAgo < 72) return "ready";
  return "fresh";
}

export interface RecoveryState {
  hoursAgo: number | null;
  sets: number;
}

/**
 * Hours since each group's last completed working set in the window. A
 * workout counts as done at local noon of its day.
 */
export function muscleRecovery(
  workouts: { date: string; exercises: WorkoutExercise[] }[],
  library: {
    id: number;
    primary_muscles?: string[] | null;
    category?: string | null;
  }[],
  windowDays = 7,
  now: number = Date.now(),
): Record<RecoveryGroup, RecoveryState> {
  const byId = new Map(library.map((e) => [e.id, e]));
  const found = new Map<RecoveryGroup, { last: number; sets: number }>();
  const cutoff = now - windowDays * 86400000;

  for (const workout of workouts) {
    const time = new Date(`${workout.date}T12:00:00`).getTime();
    if (Number.isNaN(time) || time < cutoff) continue;
    for (const exercise of workout.exercises) {
      const info = byId.get(exercise.exercise_id ?? -1);
      const names = info?.primary_muscles?.length
        ? info.primary_muscles
        : [info?.category];
      const groups = new Set(
        names.map(recoveryGroup).filter((g) => g !== null),
      );
      if (!groups.size) continue;
      for (const set of exercise.sets ?? []) {
        if (!set.completed || set.warmup) continue;
        // A hold is training too, though it carries no volume.
        const isHold =
          isTimedSet(exercise, set) && Number(set.duration_sec) > 0;
        if (!isHold && !(Number(set.weight) > 0 && Number(set.reps) > 0)) {
          continue;
        }
        for (const group of groups) {
          const entry = found.get(group) ?? { last: time, sets: 0 };
          found.set(group, {
            last: Math.max(entry.last, time),
            sets: entry.sets + 1,
          });
        }
      }
    }
  }

  return Object.fromEntries(
    RECOVERY_GROUPS.map((group) => {
      const entry = found.get(group);
      return [
        group,
        entry
          ? {
              hoursAgo: Math.max(0, Math.round((now - entry.last) / 3600000)),
              sets: entry.sets,
            }
          : { hoursAgo: null, sets: 0 },
      ];
    }),
  ) as Record<RecoveryGroup, RecoveryState>;
}
