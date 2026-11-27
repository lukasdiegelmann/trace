import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  holdMatches,
  holdResult,
  holdTimer,
  startHold,
  stopHold,
} from "./holdTimer";
import {
  addRestTime,
  configureRestTimer,
  restTimer,
  startRest,
  stopRest,
} from "./restTimer";
import {
  elapsedMs,
  formatTimerMs,
  pauseTimer,
  resetTimer,
  resumeTimer,
  sane,
  startTimer,
  timerMinutes,
  workoutTimer,
} from "./workoutTimer";

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-26T10:00:00") });
});
afterEach(() => {
  stopRest(false);
  resetTimer();
  stopHold();
  holdResult.set(null);
  vi.useRealTimers();
});

describe("workout timer (workout-timer-sane.test.js)", () => {
  it("a timer counting from 1970 is no timer", () => {
    expect(sane({ startTime: 0, baseElapsed: 0, paused: false })).toBeNull();
    expect(
      sane({
        startTime: 1791700000000,
        baseElapsed: 1791700000,
        paused: false,
      }),
    ).toBeNull();
    expect(
      sane({ startTime: 1791700000000, baseElapsed: 1800, paused: false }),
    ).not.toBeNull();
    expect(sane({ paused: true, pausedElapsed: 3600 })).not.toBeNull();
    expect(sane({ paused: true, pausedElapsed: 1791700000 })).toBeNull();
    expect(sane(null)).toBeNull();
  });

  it("counts across pause and resume from logged minutes", () => {
    startTimer("2026-11-26", 10);
    vi.advanceTimersByTime(60_000);
    pauseTimer();
    vi.advanceTimersByTime(60_000);
    expect(timerMinutes()).toBe(11);
    resumeTimer();
    vi.advanceTimersByTime(30_000);
    expect(elapsedMs(workoutTimer.get())).toBe(11.5 * 60_000);
    expect(
      JSON.parse(localStorage.getItem("lt:workoutTimer") ?? "null"),
    ).toMatchObject({ date: "2026-11-26" });
    resetTimer();
    expect(workoutTimer.get()).toBeNull();
  });

  it("formats with and without centiseconds", () => {
    expect(formatTimerMs(65_430)).toBe("1:05.43");
    expect(formatTimerMs(3_723_000, false)).toBe("1:02:03");
  });
});

describe("rest timer", () => {
  const remembered: Record<string, number> = {};
  beforeEach(() => {
    configureRestTimer({
      getPrefs: () => ({
        isEnabled: true,
        hasTone: false,
        hasVibration: false,
        toneId: "classic",
        perExercise: { 7: 45 },
      }),
      rememberRest: (id, seconds) => {
        remembered[String(id)] = seconds;
      },
      getMessages: () => ({
        countdown: String,
        completeTitle: "done",
        completeBody: String,
      }),
    });
  });

  it("falls back to the exercise's remembered rest", () => {
    startRest({ exerciseId: 7 });
    expect(restTimer.get()?.total).toBe(45);
  });

  it("extends, and closes shortly after zero", () => {
    startRest({ exerciseId: 1, durationSec: 60 });
    addRestTime(30);
    vi.advanceTimersByTime(89_000);
    expect(restTimer.get()?.total).toBe(90);
    vi.advanceTimersByTime(2_000);
    expect(restTimer.get()).toBeNull();
  });

  it("remembers the length only when asked", () => {
    startRest({ exerciseId: 2, durationSec: 120 });
    stopRest(false);
    expect(remembered["2"]).toBeUndefined();
    startRest({ exerciseId: 2, durationSec: 120 });
    stopRest(true);
    expect(remembered["2"]).toBe(120);
  });
});

describe("hold timer (hold-timer.test.js)", () => {
  const context = {
    date: "2026-09-14",
    exIdx: 2,
    setIdx: 1,
    exerciseId: 5,
    exerciseUuid: "ex",
    setUuid: "s2",
    exerciseName: "Plank",
    targetSec: 60,
  };
  const plank = {
    uuid: "ex",
    exercise_id: 5,
    sets: [{ uuid: "s1" }, { uuid: "s2" }],
  };

  it("finds its set by uuid after a reorder", () => {
    const where = { date: "2026-09-14", exIdx: 0, exercise: plank };
    expect(holdMatches(context, { ...where, setIdx: 1 })).toBe(true);
    expect(holdMatches(context, { ...where, setIdx: 0 })).toBe(false);
    expect(holdMatches(context, where)).toBe(true);
    expect(holdMatches(null, where)).toBe(false);
  });

  it("stays off another exercise and another day", () => {
    expect(
      holdMatches(context, {
        date: "2026-09-14",
        exIdx: 2,
        exercise: { ...plank, uuid: "other" },
        setIdx: 1,
      }),
    ).toBe(false);
    expect(
      holdMatches(context, { date: "2026-09-15", exIdx: 2, exercise: plank }),
    ).toBe(false);
  });

  it("falls back to position and id without uuids", () => {
    const unsaved = { ...context, exerciseUuid: null, setUuid: null };
    const fresh = { exercise_id: 5, sets: [{}, {}] };
    const where = { date: "2026-09-14", exercise: fresh, setIdx: 1 };
    expect(holdMatches(unsaved, { ...where, exIdx: 2 })).toBe(true);
    expect(holdMatches(unsaved, { ...where, exIdx: 3 })).toBe(false);
  });

  it("doesn't count the lead-in, and stopping inside it records nothing", () => {
    startHold(context);
    vi.advanceTimersByTime(2_000);
    stopHold();
    expect(holdResult.get()).toBeNull();
    startHold(context);
    vi.advanceTimersByTime(3_000 + 42_500);
    expect(stopHold()?.elapsedSec).toBe(42);
    expect(holdResult.get()?.elapsedSec).toBe(42);
    expect(holdTimer.get()).toBeNull();
  });

  it("starting a hold stops a running rest", () => {
    startRest({ durationSec: 60 });
    startHold(context);
    expect(restTimer.get()).toBeNull();
  });
});
