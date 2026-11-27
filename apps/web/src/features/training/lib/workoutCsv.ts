/**
 * A completed workout as CSV, ported from LiftTrace `src/lib/workoutCsv.js`.
 *
 * One row per set (long format). Unilateral sets with L/R reps get one row
 * per side; a unilateral exercise logged with a single `reps` value gets two
 * rows (L and R, full reps each) so totals reconcile with Statistics.
 *
 * Columns (stable order; downstream tools index by position):
 *   date, workout, exercise, exercise_index, superset, set_index, warmup,
 *   reps, weight, weight_unit, side, rpe, completed, set_notes,
 *   exercise_notes, workout_notes, workout_duration_min, duration_sec
 *
 * `weight_unit` is the user's unit at export time; values aren't converted.
 */
import { isTimedSet } from "./workout";
import type { LoadType, WorkoutLog } from "./workoutTypes";

type Cell = string | number | null | undefined;

export const CSV_COLUMNS = [
  "date",
  "workout",
  "exercise",
  "exercise_index",
  "superset",
  "set_index",
  "warmup",
  "reps",
  "weight",
  "weight_unit",
  "side",
  "rpe",
  "completed",
  "set_notes",
  "exercise_notes",
  "workout_notes",
  "workout_duration_min",
  "duration_sec",
] as const;

function escapeCell(value: Cell): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toRow(values: readonly Cell[]): string {
  return values.map(escapeCell).join(",");
}

function withSide(tail: readonly Cell[], side: "L" | "R"): Cell[] {
  const copy = [...tail];
  copy[1] = side;
  return copy;
}

export interface WorkoutCsv {
  csv: string;
  filename: string;
}

/**
 * `libraryLoadTypes` maps exercise_id to the library's load_type. With it,
 * load_type resolves per-instance -> library -> bilateral; without it, only
 * the per-instance `load_type` counts. The user's client-side preference is
 * left out on purpose: a shared CSV reports the shared truth.
 */
export function workoutToCsv(
  workout: Pick<
    WorkoutLog,
    "date" | "name" | "notes" | "duration_min" | "exercises"
  > | null,
  weightUnit: "kg" | "lbs" = "lbs",
  libraryLoadTypes?: ReadonlyMap<number, LoadType> | null,
): WorkoutCsv {
  const lines = [toRow(CSV_COLUMNS)];

  const date = workout?.date || "";
  const workoutName = workout?.name || "";
  const workoutNotes = workout?.notes || "";
  const workoutDuration = workout?.duration_min || "";

  const libraryLoadType = (id: number | null | undefined): LoadType | null =>
    libraryLoadTypes && id != null ? (libraryLoadTypes.get(id) ?? null) : null;

  (workout?.exercises ?? []).forEach((exercise, exerciseIndex) => {
    // Workout exercises carry `exercise_name`; `name` only library rows
    const exerciseName =
      exercise.exercise_name || (exercise as { name?: string }).name || "";
    const exerciseNotes = exercise.notes || "";
    const superset = exercise.superset_id || "";
    const loadType =
      exercise.load_type ||
      libraryLoadType(exercise.exercise_id) ||
      "bilateral";

    (exercise.sets ?? []).forEach((set, setIndex) => {
      const isTimed = isTimedSet(exercise, set);
      const head: Cell[] = [
        date,
        workoutName,
        exerciseName,
        exerciseIndex + 1,
        superset,
        setIndex + 1,
        set.warmup ? "true" : "false",
      ];
      const tail: Cell[] = [
        weightUnit,
        "", // side, filled per row below
        set.rpe ?? "",
        set.completed ? "true" : "false",
        set.notes || "",
        exerciseNotes,
        workoutNotes,
        workoutDuration,
        isTimed ? Number(set.duration_sec) || "" : "",
      ];
      const weight = set.weight ?? "";

      // A hold is one row with empty reps, never split by side
      if (isTimed) {
        lines.push(toRow([...head, "", weight, ...tail]));
        return;
      }
      if (set.reps_l != null || set.reps_r != null) {
        if (set.reps_l != null) {
          lines.push(
            toRow([...head, set.reps_l, weight, ...withSide(tail, "L")]),
          );
        }
        if (set.reps_r != null) {
          lines.push(
            toRow([...head, set.reps_r, weight, ...withSide(tail, "R")]),
          );
        }
      } else if (loadType === "unilateral" && set.reps != null) {
        lines.push(toRow([...head, set.reps, weight, ...withSide(tail, "L")]));
        lines.push(toRow([...head, set.reps, weight, ...withSide(tail, "R")]));
      } else {
        lines.push(toRow([...head, set.reps ?? "", weight, ...tail]));
      }
    });
  });

  const csv = lines.join("\r\n") + "\r\n";
  const safeName =
    (workoutName || "workout")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "workout";
  return { csv, filename: `lifttrace-${date || "untitled"}-${safeName}.csv` };
}

/** Downloads a blob through a temporary link */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked once the click has been handled
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Builds the CSV and downloads it (the web path of the old UI) */
export function exportWorkoutCsv(
  ...args: Parameters<typeof workoutToCsv>
): void {
  const { csv, filename } = workoutToCsv(...args);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}
