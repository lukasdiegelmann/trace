/**
 * The cook timers: several at once, kept across reloads, ringing until
 * dismissed. Ported from cooktrace/src/stores/cookTimers.js (same
 * localStorage key; the Wear OS sync is left out).
 */
import { i18n } from "@/i18n";

import { playRing, playWarning, prepareAudio, vibrate } from "./sound";
import { persistedStore } from "./store";

export interface CookTimer {
  id: string;
  label: string;
  recipeId: number | null;
  recipeName: string | null;
  stepIndex: number | null;
  durationSec: number;
  startedAt: number;
  endsAt: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- stored under this name by the old UI too
  done: boolean;
}

function parseTimers(stored: unknown): CookTimer[] {
  if (!Array.isArray(stored)) return [];
  return (stored as Partial<CookTimer>[]).filter(
    (timer): timer is CookTimer =>
      typeof timer.id === "string" && Number.isFinite(timer.endsAt),
  );
}

export const timerStore = persistedStore("ct:timers", parseTimers);

const RING_EVERY_MS = 1400;
const secondsLeft = new Map<string, number>();
const alarms = new Map<string, ReturnType<typeof setInterval>>();
let ticker: ReturnType<typeof setInterval> | null = null;

function startAlarm(id: string): void {
  if (alarms.has(id)) return;
  playRing();
  vibrate([400, 200, 400, 200, 400]);
  alarms.set(
    id,
    setInterval(() => {
      playRing();
      vibrate(220);
    }, RING_EVERY_MS),
  );
}

function silence(id: string): void {
  clearInterval(alarms.get(id));
  alarms.delete(id);
  secondsLeft.delete(id);
}

function notify(timer: CookTimer): void {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification(i18n.t("timers.doneTitle", { ns: "cooking" }), {
        body: timer.label,
        tag: timer.id,
      });
    }
  } catch {
    // some browsers only allow this from the service worker
  }
}

function tick(now: number = Date.now()): void {
  const timers = timerStore.get();
  if (timers.length === 0) {
    if (ticker) clearInterval(ticker);
    ticker = null;
    return;
  }
  let hasChange = false;
  const next = timers.map((timer) => {
    if (timer.done) return timer;
    const left = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
    if (secondsLeft.get(timer.id) !== left) {
      secondsLeft.set(timer.id, left);
      if (left >= 1 && left <= 3) playWarning();
    }
    if (now < timer.endsAt) return timer;
    hasChange = true;
    startAlarm(timer.id);
    notify(timer);
    return { ...timer, done: true };
  });
  // A new array every second, so the remaining time redraws.
  timerStore.set([...next], { isSaved: hasChange });
}

export function ensureTicker(): void {
  if (ticker || timerStore.get().length === 0) return;
  ticker = setInterval(tick, 1000);
}

export interface NewTimer {
  label: string;
  durationSec: number;
  recipeId?: number;
  recipeName?: string;
  stepIndex?: number;
}

export function startTimer(input: NewTimer): CookTimer | null {
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    return null;
  }
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
  } catch {
    // the chime works without it
  }
  prepareAudio();
  const now = Date.now();
  const timer: CookTimer = {
    id: `t_${now}_${Math.random().toString(36).slice(2, 7)}`,
    label: input.label,
    recipeId: input.recipeId ?? null,
    recipeName: input.recipeName ?? null,
    stepIndex: input.stepIndex ?? null,
    durationSec: input.durationSec,
    startedAt: now,
    endsAt: now + input.durationSec * 1000,
    done: false,
  };
  timerStore.set([...timerStore.get(), timer]);
  ensureTicker();
  return timer;
}

export function dismissTimer(id: string): void {
  silence(id);
  timerStore.set(timerStore.get().filter((timer) => timer.id !== id));
}

/** A minute more; a rung timer starts again from now and goes quiet */
export function addOneMinute(id: string): void {
  silence(id);
  const now = Date.now();
  timerStore.set(
    timerStore.get().map((timer) =>
      timer.id === id
        ? {
            ...timer,
            endsAt: (timer.done ? now : Math.max(timer.endsAt, now)) + 60_000,
            done: false,
          }
        : timer,
    ),
  );
  ensureTicker();
}

/** "4:05", or "1:02:00" past an hour */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}
