/**
 * What a diary changed and has not seen saved yet, ported from LiftTrace
 * `stores/workout.js`: a save sends the whole workout as shown, which may be
 * older than a change made elsewhere (Trace naming it, another device), so
 * the server is told which exercises, sets and details are this diary's.
 */
import type { WorkoutExercise, WorkoutLog, WorkoutSet } from "./workoutTypes";

export const DETAIL_FIELDS = [
  "name",
  "notes",
  "duration_min",
  "completed",
  "template_id",
  "program_id",
  "program_week",
] as const;

export type DetailField = (typeof DETAIL_FIELDS)[number];

/** The program, its workout and the week go together, as on the server */
const PROGRAM_FIELDS: readonly DetailField[] = [
  "template_id",
  "program_id",
  "program_week",
];

function normalised(value: unknown): string {
  if (value === undefined || value === "" || value === null) return "null";
  if (typeof value === "boolean") return value ? "1" : "0";
  return JSON.stringify(value);
}

function isSameDetail(a: unknown, b: unknown): boolean {
  return normalised(a) === normalised(b);
}

/** Equal but for fields only the screen keeps (`_…`) and `skip` */
function isSameEntry(a: object, b: object, skip?: string): boolean {
  const norm = (o: object) =>
    JSON.stringify(
      Object.entries(o)
        .filter(([k, v]) => !k.startsWith("_") && k !== skip && v !== undefined)
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  return norm(a) === norm(b);
}

export interface ChangedUuids {
  exercises: string[];
  sets: Record<string, string[]>;
}

/** The exercises and sets of `next` that are new or differ from `before` */
export function changedUuids(
  before: WorkoutExercise[],
  next: WorkoutExercise[],
): ChangedUuids {
  const was = new Map(before.filter((e) => e.uuid).map((e) => [e.uuid, e]));
  const exercises: string[] = [];
  const sets: Record<string, string[]> = {};
  for (const exercise of next) {
    if (!exercise.uuid) continue;
    const old = was.get(exercise.uuid);
    if (!old || !isSameEntry(exercise, old, "sets")) {
      exercises.push(exercise.uuid);
    }
    const oldSets = new Map(
      (old?.sets ?? []).filter((s) => s.uuid).map((s) => [s.uuid, s]),
    );
    const changed = (exercise.sets ?? []).filter(
      (set): set is WorkoutSet & { uuid: string } => {
        if (!set.uuid) return false;
        const previous = oldSets.get(set.uuid);
        return !previous || !isSameEntry(set, previous);
      },
    );
    if (changed.length) sets[exercise.uuid] = changed.map((s) => s.uuid);
  }
  return { exercises, sets };
}

export interface PendingEdits extends ChangedUuids {
  fields: Set<DetailField>;
  /** Everything noted up to this sequence number is in this save */
  upTo: number;
}

/** Edits per workout key, kept until a save carrying them reached the server */
export class EditLog {
  private readonly byKey = new Map<string, Map<string, number>>();
  private sequence = 0;

  /** `before` is what was on screen just before (null: all of it is new) */
  note(key: string, before: WorkoutLog | null, next: WorkoutLog): void {
    const changed = changedUuids(before?.exercises ?? [], next.exercises);
    const fields = before
      ? DETAIL_FIELDS.filter((f) => !isSameDetail(next[f], before[f]))
      : DETAIL_FIELDS;
    if (
      !changed.exercises.length &&
      !Object.keys(changed.sets).length &&
      !fields.length
    ) {
      return;
    }
    const entries = this.byKey.get(key) ?? new Map<string, number>();
    const at = ++this.sequence;
    for (const uuid of changed.exercises) entries.set(`e ${uuid}`, at);
    for (const [exercise, list] of Object.entries(changed.sets)) {
      for (const uuid of list) entries.set(`s ${exercise} ${uuid}`, at);
    }
    for (const field of fields) entries.set(`f ${field}`, at);
    this.byKey.set(key, entries);
  }

  pending(key: string): PendingEdits {
    const out: PendingEdits = {
      exercises: [],
      sets: {},
      fields: new Set(),
      upTo: this.sequence,
    };
    for (const entry of this.byKey.get(key)?.keys() ?? []) {
      const [kind, a = "", b = ""] = entry.split(" ");
      if (kind === "e") out.exercises.push(a);
      else if (kind === "s") (out.sets[a] ??= []).push(b);
      else out.fields.add(a as DetailField);
    }
    return out;
  }

  /** Saved: what was noted by `upTo` is the server's now */
  saved(key: string, upTo: number): void {
    const entries = this.byKey.get(key);
    if (!entries) return;
    for (const [entry, at] of entries) if (at <= upTo) entries.delete(entry);
    if (!entries.size) this.byKey.delete(key);
  }

  clear(): void {
    this.byKey.clear();
  }
}

/**
 * The details a save sends: the diary's where it changed them, the server's
 * current ones for the rest.
 */
export function detailsToSave(
  client: WorkoutLog,
  current: WorkoutLog,
  edited: Set<DetailField>,
): Partial<WorkoutLog> {
  const isProgramEdited = PROGRAM_FIELDS.some((f) => edited.has(f));
  const out: Record<string, unknown> = {};
  for (const field of DETAIL_FIELDS) {
    const isMine = PROGRAM_FIELDS.includes(field)
      ? isProgramEdited
      : edited.has(field);
    out[field] = isMine ? client[field] : current[field];
  }
  return out;
}
