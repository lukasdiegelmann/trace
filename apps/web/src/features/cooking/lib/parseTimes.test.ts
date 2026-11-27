import { describe, expect, it } from "vitest";

import { findTimes, splitWithTimes } from "./parseTimes";

const seconds = (text: string) => findTimes(text).map((m) => m.durationSec);

describe("findTimes", () => {
  it("reads single units, combined values and fractions", () => {
    expect(seconds("Bake 30 min.")).toEqual([1800]);
    expect(seconds("Rest 2 hours")).toEqual([7200]);
    expect(seconds("Simmer 1 hour 30 min")).toEqual([5400]);
    expect(seconds("Proof 1 1/2 hours")).toEqual([5400]);
    expect(seconds("Boil 1.5 hr, then 90 seconds")).toEqual([5400, 90]);
  });

  it("takes the lower bound of a range", () => {
    expect(seconds("30 to 45 min")).toEqual([1800]);
    expect(seconds("2-3 h")).toEqual([7200]);
  });

  it("ignores words that only contain a unit, and absurd durations", () => {
    expect(seconds("Add 2 mushrooms")).toEqual([]);
    expect(seconds("Age 200 hours")).toEqual([]);
  });

  it("splits text around the matches", () => {
    expect(splitWithTimes("Cook 5 min now")).toEqual([
      { type: "text", value: "Cook " },
      { type: "time", value: "5 min", durationSec: 300 },
      { type: "text", value: " now" },
    ]);
    expect(splitWithTimes("")).toEqual([{ type: "text", value: "" }]);
  });
});
