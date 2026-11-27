/**
 * The hold timer for timed sets (issue #89), ported from LiftTrace
 * `stores/holdTimer.js` and `lib/holdMatch.js`: absolute timestamps, a
 * three second lead-in that isn't counted, persisted in `lt:hold-timer`.
 * Stopping publishes `holdResult`; the card that owns the set applies it
 * through its normal update path (rest timer, PRs, supersets).
 */
import { playCountdown, playFinale, type CuePrefs } from "./cues";
import { stopRest } from "./restTimer";
import { createStore, safeStorage } from "./store";
import type { WorkoutExercise } from "./workoutTypes";

const KEY = "lt:hold-timer";
export const LEAD_IN_MS = 3000;
/** A hold left running this long was forgotten */
const STALE_MS = 3 * 60 * 60 * 1000;

export interface HoldContext {
  date: string;
  exIdx: number;
  setIdx: number;
  exerciseId: number | null;
  exerciseUuid: string | null;
  setUuid: string | null;
  exerciseName: string;
  targetSec: number;
}

export interface Hold extends HoldContext {
  startedAt: number;
  /** When counting starts, after the lead-in */
  goAt: number;
}

export interface HoldResult extends Hold {
  elapsedSec: number;
}

export const holdTimer = createStore<Hold | null>(null);
export const holdResult = createStore<HoldResult | null>(null);

let getPrefs: () => CuePrefs = () => ({
  hasTone: true,
  hasVibration: true,
  toneId: "classic",
});

export function configureHoldCues(prefs: () => CuePrefs): void {
  getPrefs = prefs;
}

let cues: ReturnType<typeof setTimeout>[] = [];

function clearCues() {
  for (const timer of cues) clearTimeout(timer);
  cues = [];
}

function schedule(hold: Hold) {
  clearCues();
  const now = Date.now();
  const at = (time: number, action: () => void) => {
    const delay = time - now;
    if (delay >= -100) cues.push(setTimeout(action, Math.max(0, delay)));
  };
  const go = () => {
    playFinale(getPrefs(), [80, 60, 80]);
  };
  at(hold.goAt - 3000, () => {
    playCountdown(3, getPrefs());
  });
  at(hold.goAt - 2000, () => {
    playCountdown(2, getPrefs());
  });
  at(hold.goAt - 1000, () => {
    playCountdown(1, getPrefs());
  });
  at(hold.goAt, go);
  // The target gets the same cue, but the clock goes on
  if (hold.targetSec > 0) at(hold.goAt + hold.targetSec * 1000, go);
}

function put(hold: Hold | null) {
  holdTimer.set(hold);
  safeStorage.write(KEY, hold);
}

export function startHold(context: HoldContext): void {
  const now = Date.now();
  const hold: Hold = {
    ...context,
    targetSec: context.targetSec || 0,
    startedAt: now,
    goAt: now + LEAD_IN_MS,
  };
  // Working now: a running rest no longer applies
  stopRest(false);
  holdResult.set(null);
  put(hold);
  schedule(hold);
}

export function skipLeadIn(): void {
  const hold = holdTimer.get();
  if (!hold || hold.goAt <= Date.now()) return;
  const next = { ...hold, goAt: Date.now() };
  put(next);
  schedule(next);
}

/** Stops; during the lead-in nothing was held and nothing is published */
export function stopHold(): HoldResult | null {
  const hold = holdTimer.get();
  if (!hold) return null;
  const elapsedSec = Math.max(0, Math.floor((Date.now() - hold.goAt) / 1000));
  clearCues();
  put(null);
  const result = { ...hold, elapsedSec };
  if (elapsedSec > 0) holdResult.set(result);
  return result;
}

export function cancelHold(): void {
  clearCues();
  put(null);
}

export function consumeHoldResult(): void {
  holdResult.set(null);
}

export function resumeHoldTimer(): void {
  if (holdTimer.get()) return;
  const hold = safeStorage.read(KEY) as Hold | null;
  if (!hold) return;
  if (!hold.goAt || Date.now() - hold.startedAt > STALE_MS) {
    safeStorage.write(KEY, null);
    return;
  }
  holdTimer.set(hold);
  schedule(hold);
}

export interface HoldTarget {
  date: string;
  exIdx: number;
  exercise: WorkoutExercise | null | undefined;
  setIdx?: number;
}

/**
 * Does a hold (or its result) belong to this exercise, or set? Uuids win;
 * the position is the fallback for an exercise not saved yet. Leave out
 * `setIdx` to ask about the exercise only.
 */
export function holdMatches(
  hold: HoldContext | null,
  { date, exIdx, exercise, setIdx }: HoldTarget,
): boolean {
  if (!hold || hold.date !== date || !exercise) return false;
  const isSameExercise =
    hold.exerciseUuid && exercise.uuid
      ? hold.exerciseUuid === exercise.uuid
      : hold.exIdx === exIdx &&
        hold.exerciseId === (exercise.exercise_id ?? null);
  if (!isSameExercise) return false;
  if (setIdx == null) return true;
  const set = exercise.sets?.[setIdx];
  if (hold.setUuid && set?.uuid) return hold.setUuid === set.uuid;
  return hold.setIdx === setIdx;
}
