/**
 * The rest timer, ported from LiftTrace `stores/restTimer.js`: an absolute
 * end time (so throttled or locked screens still read right), persisted in
 * `lt:rest-timer`, with 3-2-1 cues and, in the background, service worker
 * notifications. The Capacitor and watch paths are native-only.
 */
import { playCountdown, playFinale, type CuePrefs } from "./cues";
import { createStore, safeStorage } from "./store";

const KEY = "lt:rest-timer";
/** How long 0:00 stays before the bar closes */
const LINGER_MS = 700;

export interface RestState {
  startedAt: number;
  endTime: number;
  /** seconds */
  total: number;
  exerciseId: number | null;
  exerciseName: string;
}

export interface RestPrefs extends CuePrefs {
  /** Setting `restAlert`: off means no rest timer at all */
  isEnabled: boolean;
  perExercise: Record<string, number>;
}

/** Texts of the background notifications, from i18n */
export interface RestMessages {
  countdown: (n: number) => string;
  completeTitle: string;
  completeBody: (exerciseName: string) => string;
}

export interface RestConfig {
  getPrefs: () => RestPrefs;
  rememberRest: (exerciseId: number, seconds: number) => void;
  getMessages: () => RestMessages;
}

let config: RestConfig = {
  getPrefs: () => ({
    isEnabled: true,
    hasTone: true,
    hasVibration: true,
    toneId: "classic",
    perExercise: {},
  }),
  rememberRest: () => undefined,
  getMessages: () => ({
    countdown: (n) => `Rest: ${n}`,
    completeTitle: "Rest complete",
    completeBody: (name) => name,
  }),
};

export function configureRestTimer(next: RestConfig): void {
  config = next;
}

function load(): RestState | null {
  const state = safeStorage.read(KEY) as RestState | null;
  if (!state?.endTime || state.endTime <= Date.now()) return null;
  return state;
}

export const restTimer = createStore<RestState | null>(null);

let cues: ReturnType<typeof setTimeout>[] = [];

function clearCues() {
  for (const timer of cues) clearTimeout(timer);
  cues = [];
}

async function showNotification(
  title: string,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the Notification API's names
  options: NotificationOptions & { vibrate?: number[]; renotify?: boolean },
): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.showNotification(title, options);
  } catch {
    // No notification is fine: the bar still shows the time
  }
}

function countdownCue(n: number) {
  const prefs = config.getPrefs();
  if (document.visibilityState === "hidden") {
    void showNotification(config.getMessages().countdown(n), {
      tag: "rest-timer-countdown",
      silent: true,
      vibrate: prefs.hasVibration ? [40] : [],
    });
    return;
  }
  playCountdown(n, prefs);
}

function finish() {
  const state = restTimer.get();
  const prefs = config.getPrefs();
  if (document.visibilityState === "hidden") {
    const messages = config.getMessages();
    void showNotification(messages.completeTitle, {
      body: messages.completeBody(state?.exerciseName ?? ""),
      icon: "/icons/pwa-192x192.png",
      tag: "rest-timer",
      renotify: true,
      silent: !prefs.hasTone,
      vibrate: prefs.hasVibration ? [180, 80, 180, 80, 220] : [],
    });
  } else {
    playFinale(prefs, [180, 80, 180]);
  }
  cues.push(
    setTimeout(() => {
      stopRest(false);
    }, LINGER_MS),
  );
}

function schedule(state: RestState) {
  clearCues();
  const now = Date.now();
  const plan: [number, () => void][] = [
    [
      state.endTime - 3000,
      () => {
        countdownCue(3);
      },
    ],
    [
      state.endTime - 2000,
      () => {
        countdownCue(2);
      },
    ],
    [
      state.endTime - 1000,
      () => {
        countdownCue(1);
      },
    ],
    [state.endTime, finish],
  ];
  for (const [at, action] of plan) {
    const delay = at - now;
    if (delay < -100) continue;
    cues.push(setTimeout(action, Math.max(0, delay)));
  }
}

function put(state: RestState | null) {
  restTimer.set(state);
  safeStorage.write(KEY, state);
}

export interface StartRest {
  exerciseId?: number | null;
  exerciseName?: string;
  durationSec?: number | null;
}

export function startRest({
  exerciseId = null,
  exerciseName = "",
  durationSec,
}: StartRest = {}): void {
  const prefs = config.getPrefs();
  let total = durationSec ?? null;
  if (total == null && exerciseId != null) {
    total = prefs.perExercise[String(exerciseId)] ?? null;
  }
  if (total == null || total <= 0 || !prefs.isEnabled) return;
  // Only a user gesture (ticking a set) may ask for permission
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
  } catch {
    // Not available
  }
  const state: RestState = {
    startedAt: Date.now(),
    endTime: Date.now() + total * 1000,
    total,
    exerciseId,
    exerciseName,
  };
  put(state);
  schedule(state);
}

export function addRestTime(extraSec = 30): void {
  const state = restTimer.get();
  if (!state) return;
  const next = {
    ...state,
    endTime: state.endTime + extraSec * 1000,
    total: state.total + extraSec,
  };
  put(next);
  schedule(next);
}

/** `shouldRemember`: keep this length as the exercise's rest */
export function stopRest(shouldRemember = true): void {
  const state = restTimer.get();
  if (
    shouldRemember &&
    state?.exerciseId != null &&
    state.total > 0 &&
    config.getPrefs().perExercise[String(state.exerciseId)] !== state.total
  ) {
    config.rememberRest(state.exerciseId, state.total);
  }
  put(null);
  clearCues();
}

export function remainingSeconds(
  state: RestState | null,
  now: number = Date.now(),
): number {
  return state ? Math.max(0, (state.endTime - now) / 1000) : 0;
}

/** Restores a rest running before a reload; re-arms cues on return */
export function resumeRestTimer(): () => void {
  if (!restTimer.get()) {
    const saved = load();
    if (saved) {
      restTimer.set(saved);
      schedule(saved);
    } else {
      safeStorage.write(KEY, null);
    }
  }
  const onVisible = () => {
    const state = restTimer.get();
    if (state && document.visibilityState === "visible") schedule(state);
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
  };
}
