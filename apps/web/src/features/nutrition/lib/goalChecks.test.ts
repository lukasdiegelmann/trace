import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyDay, fakeNutriTrace } from "../assistant/testApi";
import { localDateStr } from "./dates";
import { checkDiaryGoals, checkWellnessGoals, goalTargets } from "./goalChecks";
import type { DiaryItem } from "../api";

const today = localDateStr();

afterEach(() => {
  vi.restoreAllMocks();
});

const claimed = (writes: { path: string; body: unknown }[]) =>
  writes
    .filter((write) => write.path === "/settings/claim-celebration")
    .map((write) => (write.body as { key: string }).key);

describe("goalTargets", () => {
  it("resolves weekday goals and percent macros for the day", () => {
    const days = [100, 100, 100, 100, 100, 100, 100];
    expect(
      goalTargets(
        {
          calories: { max: 2000 },
          proteins: { min: 30, isPercent: true },
          fiber: { min: 500, sharedGoal: false, days },
        },
        today,
      ),
    ).toMatchObject({
      proteins: { min: 150 },
      fiber: { min: 100 },
    });
  });
});

describe("checkDiaryGoals", () => {
  const day = {
    ...emptyDay(today),
    water: [{ uuid: "w", amount: 2500, time: "" }],
    items: [
      { nutrition: { calories: 500, proteins: 10 }, quantity: 1 },
    ] as unknown as DiaryItem[],
  };

  it("claims what today's food and water reach", async () => {
    const fake = await fakeNutriTrace({
      settings: {
        waterGoalMl: 2000,
        goals: { calories: { max: 2000 }, proteins: { min: 10 } },
      },
    });
    await checkDiaryGoals(day);
    expect(claimed(fake.writes)).toEqual([
      `proteins_${today}`,
      `water_ml_${today}`,
    ]);
  });

  it("ignores another day", async () => {
    const fake = await fakeNutriTrace();
    await checkDiaryGoals({ ...day, date: "2020-01-01" });
    expect(fake.writes).toEqual([]);
  });
});

describe("checkWellnessGoals", () => {
  it("claims the step goal and the wellness goals", async () => {
    const fake = await fakeNutriTrace({
      settings: {
        goals: { steps: { min: 8000 }, active_minutes: { min: 30 } },
      },
      gets: {
        "/wellness/fitbit/data": {
          [today]: { steps: 9000, active_minutes: 45 },
        },
        "/wellness/garmin/data": {},
      },
    });
    await checkWellnessGoals();
    expect(claimed(fake.writes)).toEqual([
      "steps_hit",
      `active_minutes_${today}`,
    ]);
  });
});
