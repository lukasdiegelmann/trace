/* eslint-disable @typescript-eslint/naming-convention -- the model's and the backend's JSON keys */
/**
 * Smart Log: a described session as diary exercises, ported from LiftTrace
 * `src/lib/smartLogWorkout.js`. The model parses the words, the names are
 * matched against the library, and the reviewed items join the workout.
 */
import { recalcSuperset } from "./supersets";
import { toText } from "./searchText";
import type { WorkoutExercise, WorkoutSet } from "./workoutTypes";

export const PARSE_SYSTEM_PROMPT = `You parse weightlifting session descriptions into structured JSON.

Output ONLY valid JSON matching this schema:
{
  "exercises": [
    {
      "name": "exercise name exactly as user said it",
      "sets": [ { "reps": N, "weight": N, "duration_sec": N|null, "rpe": N|null, "amrap": true|false, "bodyweight": true|false } ],
      "superset_group": "A"|"B"|null,   // fill only when user groups exercises (A1/A2/B1/B2 etc.)
      "notes": string|null
    }
  ]
}

Rules:
- "3x5 @ 225" means 3 identical sets of {reps:5, weight:225}. Expand it.
- "225x5, 245x5, 265x5" means 3 different sets — preserve each.
- "BW" or "bodyweight" → set bodyweight:true and weight:0 (unless user said "BW+25" → bodyweight:true, weight:25).
- "@8" or "RPE 8" → rpe:8.
- "AMRAP" or "as many as possible" → amrap:true and reps:0.
- Timed holds and carries are logged by duration, not reps: "plank 3x45s", "plank 3x1:00", "wall sit 90 seconds", "dead hang 2 min". Put the time in duration_sec as whole seconds and set reps:0. "3x45s" means 3 sets of {duration_sec:45}. A bare "x60" on a plank, wall sit, hold, hang or carry means 60 seconds, not 60 reps. "farmer carry 3x40s @ 50" is duration_sec:40, weight:50.
- "A1: bench, A2: row, 3 rounds" — emit bench AND row with 3 sets each, superset_group:"A".
- Assume pounds unless user says "kg". Do NOT convert units.
- If user gives a range like "3x8-10", pick the midpoint (9).
- Return empty exercises array if you cannot parse anything meaningful.
- NEVER include text outside the JSON. No markdown code fences.`;

export interface ParsedSet {
  reps: number;
  weight: number;
  duration_sec?: number;
  rpe?: number;
  amrap?: boolean;
  bodyweight?: boolean;
}

export interface ParsedExercise {
  name: string;
  sets: ParsedSet[];
  supersetGroup: string | null;
  notes: string | null;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

function parsedSet(value: unknown): ParsedSet {
  const set = record(value);
  const duration = Math.round(Number(set.duration_sec));
  const rpe = set.rpe == null ? NaN : Number(set.rpe);
  return {
    reps: Number(set.reps) || 0,
    weight: Number(set.weight) || 0,
    ...(duration > 0 ? { duration_sec: duration } : {}),
    ...(Number.isFinite(rpe) ? { rpe } : {}),
    ...(set.amrap ? { amrap: true } : {}),
    ...(set.bodyweight ? { bodyweight: true } : {}),
  };
}

/** The exercises of the model's JSON; null when it isn't what was asked */
export function readParsedExercises(
  reply: Record<string, unknown> | null,
): ParsedExercise[] | null {
  const exercises = reply?.exercises;
  if (!Array.isArray(exercises)) return null;
  return exercises.flatMap((value: unknown) => {
    const exercise = record(value);
    const name = toText(exercise.name).trim();
    if (!name) return [];
    return [
      {
        name,
        sets: Array.isArray(exercise.sets) ? exercise.sets.map(parsedSet) : [],
        supersetGroup: toText(exercise.superset_group) || null,
        notes: toText(exercise.notes) || null,
      },
    ];
  });
}

export interface LibraryEntry {
  id: number;
  name: string;
}

/** Higher is better: exact 100, prefix 85, substring 70, shared words ≤ 50 */
export function scoreMatch(query: string, name: string): number {
  const q = query.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  if (!q || !n) return 0;
  if (q === n) return 100;
  if (n.startsWith(q)) return 85;
  if (n.includes(q)) return 70;
  const words = new Set(q.split(/\s+/));
  const nameWords = new Set(n.split(/\s+/));
  const hits = [...words].filter((word) => nameWords.has(word)).length;
  return hits ? Math.round((hits / words.size) * 50) : 0;
}

const ALIASES: Partial<Record<string, string>> = {
  bp: "bench press",
  ohp: "overhead press",
  "military press": "overhead press",
  mp: "overhead press",
  dl: "deadlift",
  sq: "squat",
  rdl: "romanian deadlift",
  bb: "barbell",
  db: "dumbbell",
};

export interface Candidate {
  exercise: LibraryEntry;
  score: number;
}

export interface MatchedExercise extends ParsedExercise {
  /** The best five of the library */
  candidates: Candidate[];
  /** The chosen entry; null keeps the name as it was said */
  best: LibraryEntry | null;
}

export function matchExercises(
  parsed: ParsedExercise[],
  library: LibraryEntry[],
): MatchedExercise[] {
  return parsed.map((exercise) => {
    const name = exercise.name.toLowerCase().trim();
    const queries = [...new Set([name, ALIASES[name] ?? name])];
    const candidates = library
      .map((entry) => ({
        exercise: entry,
        score: Math.max(...queries.map((q) => scoreMatch(q, entry.name))),
      }))
      .filter((candidate) => candidate.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { ...exercise, candidates, best: candidates[0]?.exercise ?? null };
  });
}

/** The workout's exercises with the reviewed ones behind them */
export function mergeIntoWorkout(
  matched: MatchedExercise[],
  existing: WorkoutExercise[],
): WorkoutExercise[] {
  let highest = existing.reduce(
    (max, e) =>
      typeof e.superset_id === "number" ? Math.max(max, e.superset_id) : max,
    0,
  );
  const groups = new Map<string, number>();
  const added = matched.map((item): WorkoutExercise => {
    const sets: WorkoutSet[] = item.sets.map((set) => ({
      ...set,
      completed: false,
      notes: "",
    }));
    const first = item.sets.at(0);
    let supersetId: number | undefined;
    if (item.supersetGroup) {
      supersetId = groups.get(item.supersetGroup) ?? ++highest;
      groups.set(item.supersetGroup, supersetId);
    }
    // A timed exercise gets its type and a target time (issue #89)
    const isTimed = item.sets.some((set) => set.duration_sec);
    return {
      exercise_id: item.best?.id ?? null,
      exercise_name: item.best?.name ?? item.name,
      sets,
      target_sets: item.sets.length || 1,
      target_reps: isTimed ? null : first?.reps || null,
      target_weight: first?.weight || null,
      notes: item.notes ?? "",
      ...(isTimed
        ? {
            set_type: "time" as const,
            target_duration: String(first?.duration_sec ?? ""),
          }
        : {}),
      ...(supersetId != null ? { superset_id: supersetId } : {}),
    };
  });
  return [...groups.values()].reduce(recalcSuperset, [...existing, ...added]);
}
