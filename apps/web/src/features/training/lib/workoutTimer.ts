/* eslint-disable @typescript-eslint/naming-convention -- `paused` is the stored shape of lt:workoutTimer */
/**
 * The workout timer, ported from LiftTrace `stores/workoutTimer.js`:
 * absolute timestamps, persisted in `lt:workoutTimer`, so a reload or a
 * locked phone still reads the right time. Watch sync is native-only and
 * not ported.
 */
import { createStore, safeStorage } from "./store";

const KEY = "lt:workoutTimer";

export interface RunningTimer {
  date: string;
  /** ms epoch of the last start/resume */
  startTime: number;
  /** seconds counted before `startTime` */
  baseElapsed: number;
  paused: false;
}

export interface PausedTimer {
  date: string;
  startTime?: number;
  baseElapsed?: number;
  paused: true;
  pausedElapsed: number;
}

export type TimerState = RunningTimer | PausedTimer | null;

/** A timer that can't be right (counting from 1970) is no timer */
export function sane(state: unknown): TimerState {
  if (!state || typeof state !== "object") return null;
  const s = state as {
    paused?: boolean;
    pausedElapsed?: unknown;
    startTime?: unknown;
    baseElapsed?: unknown;
  };
  const isSeconds = (v: unknown) => Number(v) >= 0 && Number(v) < 1e7;
  if (s.paused) return isSeconds(s.pausedElapsed) ? (s as PausedTimer) : null;
  return Number(s.startTime) > 1e12 && isSeconds(s.baseElapsed ?? 0)
    ? (s as RunningTimer)
    : null;
}

export function elapsedMs(state: TimerState, now: number = Date.now()): number {
  if (!state) return 0;
  if (state.paused) return state.pausedElapsed * 1000;
  return Math.max(0, state.baseElapsed * 1000 + (now - state.startTime));
}

/** MM:SS.cs or H:MM:SS.cs */
export function formatTimerMs(ms: number, hasCentis = true): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  const base = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  return hasCentis
    ? `${base}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`
    : base;
}

export const workoutTimer = createStore<TimerState>(
  sane(safeStorage.read(KEY)),
);

function save(state: TimerState) {
  workoutTimer.set(state);
  safeStorage.write(KEY, state ? { ...state, at: Date.now() } : null);
}

/** Starts for a date, continuing from `fromMinutes` already logged */
export function startTimer(date: string, fromMinutes = 0): void {
  save({
    date,
    startTime: Date.now(),
    baseElapsed: Math.round(fromMinutes * 60),
    paused: false,
  });
}

export function pauseTimer(): void {
  const state = workoutTimer.get();
  if (!state || state.paused) return;
  save({
    ...state,
    paused: true,
    pausedElapsed: state.baseElapsed + (Date.now() - state.startTime) / 1000,
  });
}

export function resumeTimer(): void {
  const state = workoutTimer.get();
  if (!state?.paused) return;
  save({
    date: state.date,
    startTime: Date.now(),
    baseElapsed: state.pausedElapsed,
    paused: false,
  });
}

/** Clears the timer; the duration already saved on a workout stays */
export function resetTimer(): void {
  save(null);
}

/** Minutes so far, to 0.1 */
export function timerMinutes(state: TimerState = workoutTimer.get()): number {
  return Math.round((elapsedMs(state) / 60000) * 10) / 10;
}
