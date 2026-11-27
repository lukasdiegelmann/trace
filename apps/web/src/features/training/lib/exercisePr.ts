/**
 * An exercise's record and its top set per session, after
 * ExerciseDetail.svelte. Unlike the original, warm-ups never count as a
 * record, and every screen judges timed exercises the same way.
 */
import { type HistoryEntry, isTimedSet, type WorkoutSet } from "./workout";

function workingSets(entry: HistoryEntry): WorkoutSet[] {
  return (entry.sets ?? []).filter((set) => set.completed && !set.warmup);
}

/** Timed if the most recent session with a working set was */
export function isTimedHistory(history: HistoryEntry[]): boolean {
  const latest = history.find((entry) => workingSets(entry).length > 0);
  return !!latest && workingSets(latest).some((set) => isTimedSet(latest, set));
}

export interface ExerciseRecord {
  isTimed: boolean;
  /** Seconds of the longest hold (timed), else the heaviest weight */
  value: number;
  /** The weight held during the longest hold */
  weight: number;
  date: string;
}

/** The longest hold (heavier wins a tie) or the heaviest working set */
export function exerciseRecord(history: HistoryEntry[]): ExerciseRecord | null {
  const isTimed = isTimedHistory(history);
  let best: ExerciseRecord | null = null;
  for (const entry of history) {
    for (const set of workingSets(entry)) {
      if (isTimedSet(entry, set) !== isTimed) continue;
      const weight = Number(set.weight) || 0;
      const value = isTimed ? Number(set.duration_sec) || 0 : weight;
      if (value <= 0) continue;
      if (
        !best ||
        value > best.value ||
        (isTimed && value === best.value && weight > best.weight)
      ) {
        best = { isTimed, value, weight, date: entry.date };
      }
    }
  }
  return best;
}

export interface TopSetPoint {
  date: string;
  value: number;
}

/** The last 24 sessions' top set of the record's kind, oldest first */
export function topSetPoints(history: HistoryEntry[]): TopSetPoint[] {
  const isTimed = isTimedHistory(history);
  const points: TopSetPoint[] = [];
  for (const entry of [...history].reverse()) {
    let top = 0;
    for (const set of workingSets(entry)) {
      if (isTimedSet(entry, set) !== isTimed) continue;
      const value = Number(isTimed ? set.duration_sec : set.weight) || 0;
      if (value > top) top = value;
    }
    if (top > 0) points.push({ date: entry.date, value: top });
  }
  return points.slice(-24);
}
