/**
 * Where the assistant meets the open diary: which workout a dated tool means,
 * and showing what it saved there (after LiftTrace `src/lib/aiTools.js`,
 * `_workoutForDate` and `_showInDiary`).
 */
import { workoutApi } from "../diary/api";
import { diaryStore } from "../diary/diaryStore";
import type { WorkoutLog } from "../lib/workoutTypes";

/** The date the diary is on, which need not be today */
export function diaryDate(): string {
  return diaryStore.state.get().date;
}

/** A diary change still waiting to save goes up before a tool reads */
export async function settleDiary(): Promise<void> {
  await diaryStore.flush().catch(() => undefined);
}

/**
 * The workout a tool that names a date reads and writes: the one open in the
 * diary when it's that date, else the date's first (issue #142). A failed
 * read is an error, never a reason to write into another one.
 */
export async function workoutForDate(date: string): Promise<WorkoutLog | null> {
  const { date: shownDate, sessionId } = diaryStore.state.get();
  if (date === shownDate && sessionId != null) {
    const { workout } = await workoutApi.get(date, sessionId);
    if (workout && !workout.deleted_at && workout.id === sessionId) {
      return workout;
    }
  }
  return (await workoutApi.get(date)).workout;
}

/**
 * What a tool saved into the workout open in the diary shows there at once:
 * the diary saves its whole copy back, so an older one would undo the tool.
 * A new workout opens (`isOpening`).
 */
export function showInDiary(
  date: string,
  workout: WorkoutLog | null | undefined,
  { isOpening = false }: { isOpening?: boolean } = {},
): void {
  if (workout?.id == null || date !== diaryDate()) return;
  const shown = diaryStore.state.get().sessionId;
  if (!isOpening && shown != null && shown !== workout.id) return;
  diaryStore.show(date, workout);
  if (isOpening || shown == null) void diaryStore.loadSessions(date);
}
