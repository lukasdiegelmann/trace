import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearChecks,
  cookList,
  cookStore,
  endCook,
  readChecks,
  startCook,
  writeChecks,
} from "./cooks";
import {
  addOneMinute,
  dismissTimer,
  formatRemaining,
  startTimer,
  timerStore,
} from "./timers";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  for (const timer of timerStore.get()) dismissTimer(timer.id);
  for (const cook of cookList(cookStore.get())) endCook(cook.id);
  vi.useRealTimers();
});

describe("timers", () => {
  it("formats the remaining time", () => {
    expect(formatRemaining(65_000)).toBe("1:05");
    expect(formatRemaining(3_720_000)).toBe("1:02:00");
    expect(formatRemaining(-5)).toBe("0:00");
  });

  it("runs several, finishes them and keeps them until dismissed", () => {
    const first = startTimer({ label: "a", durationSec: 2 });
    startTimer({ label: "b", durationSec: 90 });
    expect(startTimer({ label: "none", durationSec: 0 })).toBeNull();
    vi.advanceTimersByTime(3000);
    expect(timerStore.get().map((t) => t.done)).toEqual([true, false]);
    expect(localStorage.getItem("ct:timers")).toContain('"done":true');
    dismissTimer(first?.id ?? "");
    expect(timerStore.get().map((t) => t.label)).toEqual(["b"]);
  });

  it("gives a rung timer a minute from now", () => {
    const timer = startTimer({ label: "a", durationSec: 1 });
    vi.advanceTimersByTime(5000);
    addOneMinute(timer?.id ?? "");
    const [after] = timerStore.get();
    expect(after.done).toBe(false);
    expect(after.endsAt - Date.now()).toBe(60_000);
  });
});

describe("cooks", () => {
  it("lists several cooks in start order and clears a cook's checks", () => {
    startCook(7, "Soup", "");
    startCook(3, "Bread", "");
    expect(cookList(cookStore.get()).map((c) => c.id)).toEqual([7, 3]);
    writeChecks(7, { ingredients: ["0-1"], steps: [2], tools: [] });
    expect(readChecks(7).ingredients).toEqual(["0-1"]);
    endCook(7);
    expect(readChecks(7)).toEqual({ ingredients: [], steps: [], tools: [] });
    expect(cookList(cookStore.get()).map((c) => c.id)).toEqual([3]);
    clearChecks(3);
  });
});
