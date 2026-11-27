import { describe, expect, it } from "vitest";

import { shareCardFilename, topSet } from "./shareCard";

describe("share card", () => {
  it("headlines the heaviest lift or the longest hold", () => {
    expect(
      topSet({
        sets: [
          { weight: 100, reps: 3, completed: true },
          { weight: 100, reps: 5, completed: true },
          { weight: 120, reps: 5, completed: false },
        ],
      }),
    ).toMatchObject({ weight: 100, reps: 5 });
    expect(
      topSet({
        sets: [
          { duration_sec: 30, weight: 20, completed: true },
          { duration_sec: 60, completed: true },
        ],
      }),
    ).toMatchObject({ duration_sec: 60 });
  });

  it("names the file after workout and day", () => {
    expect(
      shareCardFilename({
        name: "Push Day",
        date: "2026-11-26",
        exercises: [],
      }),
    ).toBe("lifttrace-push-day-2026-11-26.png");
  });
});
