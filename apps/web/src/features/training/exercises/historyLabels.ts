import type { ExerciseRecord } from "../lib/exercisePr";
import {
  fmtSetDuration,
  fmtSetLabel,
  type HistoryEntry,
  isTimedSet,
  type WorkoutSet,
} from "../lib/workout";

/** A logged set as the history row shows it: "100×5", "30×5+5", "1:00" */
export function historySetLabel(
  set: WorkoutSet,
  entry: HistoryEntry,
  loadType: string | null | undefined,
): string {
  if (isTimedSet(entry, set)) return fmtSetLabel({ set_type: "time" }, set);
  const weight = String(set.weight ?? 0);
  if (loadType === "unilateral" && (set.reps_l != null || set.reps_r != null)) {
    return `${weight}×${String(set.reps_l ?? "")}+${String(set.reps_r ?? "")}`;
  }
  return `${weight}×${String(set.reps ?? 0)}`;
}

/** "100 kg", or a hold as "1:00" / "1:00 @ 10 kg" */
export function recordText(record: ExerciseRecord, unit: string): string {
  if (!record.isTimed) return `${record.value} ${unit}`;
  const time = fmtSetDuration(record.value);
  return record.weight ? `${time} @ ${record.weight} ${unit}` : time;
}
