import { describe, expect, it } from "vitest";

import { fastingDays, fastingStats, formatFastDuration } from "./fasting";
import {
  calcReadiness,
  chronotype,
  crossedGoals,
  formatClock,
  formatDuration,
  formatMetricValue,
  formatSleepText,
  heartRateZone,
  mergeDisplayData,
  readinessForToday,
  readinessInsight,
  resilienceCategory,
  sleepDebt,
  sleepMidpoint,
  sleepStages,
  syncFrom,
  toggleMetric,
  weekActivity,
  workoutKind,
  WELLNESS_METRICS,
  type Readiness,
  type ReadinessDay,
} from "./wellness";

const SETTINGS = {
  distUnit: "km",
  energyUnit: "kcal",
  tempUnit: "C",
  weightUnit: "kg",
  locale: "en",
};

function metric(id: string) {
  const m = WELLNESS_METRICS.find((x) => x.id === id);
  if (!m) throw new Error(id);
  return m;
}

describe("formatting", () => {
  it("formats distance, sleep, energy, skin temperature and cardio fitness", () => {
    expect(
      formatMetricValue(metric("distance_km"), 5, {
        ...SETTINGS,
        distUnit: "mi",
      }),
    ).toEqual({
      value: "3.11",
      unit: "mi",
    });
    expect(
      formatMetricValue(metric("sleep_duration_min"), 450, SETTINGS),
    ).toEqual({
      value: "7h 30m",
      unit: "",
    });
    expect(formatMetricValue(metric("sleep_deep_min"), 45, SETTINGS)).toEqual({
      value: "45",
      unit: "min",
    });
    expect(
      formatMetricValue(metric("calories_out"), 2500, {
        ...SETTINGS,
        energyUnit: "kJ",
      }),
    ).toEqual({
      value: "10,460",
      unit: "kJ",
    });
    expect(
      formatMetricValue(metric("skin_temp_variation"), 0.5, {
        ...SETTINGS,
        tempUnit: "F",
      }),
    ).toEqual({
      value: "+0.90",
      unit: "°F",
    });
    expect(
      formatMetricValue(metric("vo2_max"), 41, SETTINGS, "39-43")?.value,
    ).toBe("39-43");
    expect(formatMetricValue(metric("steps"), null, SETTINGS)).toBeNull();
    expect(formatSleepText(480)).toBe("8h");
    expect(formatSleepText(null)).toBe("—");
  });

  it("formats durations, clock times and HR zones", () => {
    expect(formatDuration(3723000)).toBe("1:02:03");
    expect(formatDuration(123000)).toBe("2:03");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatClock(90, "12h")).toBe("1:30 AM");
    expect(formatClock(0, "12h")).toBe("12:00 AM");
    expect(formatClock(13 * 60 + 5, "24h")).toBe("13:05");
    expect(heartRateZone(120)).toBe("easy");
    expect(heartRateZone(140)).toBe("moderate");
    expect(heartRateZone(160)).toBe("hard");
    expect(heartRateZone(175)).toBe("peak");
  });

  it("names workouts by kind", () => {
    expect(workoutKind("Morning Run")).toBe("run");
    expect(workoutKind("Outdoor Bike")).toBe("bike");
    expect(workoutKind("Weights")).toBe("strength");
    expect(workoutKind(null)).toBe("other");
  });
});

describe("display data", () => {
  it("lays the fitbit family over Garmin, but keeps Garmin's sleep score", () => {
    const data = mergeDisplayData(
      { steps: 100, sleep_score: 80 },
      { steps: 200, sleep_score: 70, readiness_score_actual: 77 },
      { isGarminEnabled: true, isFitbitFamilyEnabled: true },
    );
    expect(data.steps).toBe(200);
    expect(data.sleep_score).toBe(80);
    expect(data.readiness_score).toBe(77);
  });

  it("ignores disabled sources", () => {
    expect(
      mergeDisplayData(
        { steps: 1 },
        { steps: 2 },
        {
          isGarminEnabled: false,
          isFitbitFamilyEnabled: true,
        },
      ).steps,
    ).toBe(2);
  });

  it("toggles metrics starting from all visible", () => {
    const next = toggleMetric(null, "steps", ["steps", "floors"]);
    expect(next).toEqual(["floors"]);
    expect(toggleMetric(next, "steps")).toEqual(["floors", "steps"]);
  });
});

describe("sleep", () => {
  it("splits the night into stages", () => {
    const { total, stages } = sleepStages({
      sleep_deep_min: 60,
      sleep_rem_min: 90,
      sleep_light_min: 240,
      sleep_wake_min: 10,
    });
    expect(total).toBe(400);
    expect(stages[0]).toEqual({ id: "deep", minutes: 60, pct: 15 });
  });

  it("adds up the debt against the goal (max ?? min ?? 480)", () => {
    const nights = [400, null, 500, 420].map((d) => ({
      sleep_duration_min: d,
      sleep_start_min: null,
      sleep_end_min: null,
    }));
    expect(sleepDebt(nights, 14, undefined)).toEqual({
      debtMin: 140,
      nights: 3,
      goalMin: 480,
    });
    expect(sleepDebt(nights, 1, { min: 420 })).toEqual({
      debtMin: 0,
      nights: 1,
      goalMin: 420,
    });
    expect(sleepDebt([], 7, undefined)).toBeNull();
  });

  it("finds the midpoint across midnight", () => {
    expect(sleepMidpoint(22 * 60 + 30, 6 * 60 + 30)).toBe(150);
    expect(sleepMidpoint(60, 7 * 60)).toBe(240);
    expect(sleepMidpoint(null, 1)).toBeNull();
  });

  it("classifies the chronotype after 5 nights", () => {
    const night = (start: number, end: number) => ({
      sleep_duration_min: 400,
      sleep_start_min: start,
      sleep_end_min: end,
    });
    expect(chronotype([night(1380, 420), night(1380, 420)])).toEqual({
      type: null,
      nights: 2,
      needed: 5,
    });
    const five = Array.from({ length: 5 }, () => night(1380, 420));
    expect(chronotype(five)).toEqual({
      type: "morning",
      midpointMin: 180,
      nights: 5,
    });
    expect(chronotype([])).toBeNull();
  });
});

describe("readiness", () => {
  const history = (hrv: number, rhr: number, n = 10): ReadinessDay[] =>
    Array.from({ length: n }, () => ({
      hrv_daily_rmssd: hrv,
      resting_hr: rhr,
      calories_out: 2000,
    }));

  it("needs HRV today and 2 nights of history", () => {
    expect(calcReadiness(null, 50, 80, null, history(40, 50))).toBeNull();
    expect(calcReadiness(40, 50, 80, null, history(40, 50, 1))).toEqual({
      isCalibrating: true,
      data_days: 1,
      needed: 3,
    });
  });

  it("scores a day at baseline", () => {
    const r = calcReadiness(40, 50, 80, 2000, history(40, 50)) as Readiness;
    // 0.75×65 + 0.05×59 + 0.12×80 + 4 = 65.3 → 65
    expect(r.score).toBe(65);
    expect(r.band).toBe("good");
    expect(r.hrv_baseline).toBe(40);
    expect(r.data_days).toBe(11);
  });

  it("penalizes low HRV with a raised RHR and caps on bad sleep", () => {
    const r = calcReadiness(20, 60, 40, 2000, history(40, 50)) as Readiness;
    expect(r.interaction_penalty).toBe(15);
    expect(r.score).toBeLessThanOrEqual(65);
    expect(r.band === "poor" || r.band === "low").toBe(true);
  });

  it("penalizes a spike in activity", () => {
    const r = calcReadiness(40, 50, 80, 4000, history(40, 50)) as Readiness;
    expect(r.activity_penalty).toBe(20);
  });

  it("prefers the stored score for today", () => {
    const days = ["d1", "d2", "d3", "today"];
    const fitbit = {
      d1: { hrv_daily_rmssd: 40, resting_hr: 50 },
      d2: { hrv_daily_rmssd: 40, resting_hr: 50 },
      d3: { hrv_daily_rmssd: 40, resting_hr: 50 },
    };
    const r = readinessForToday(
      { hrv_daily_rmssd: 40, resting_hr: 50, readiness_score: 88.4 },
      days,
      {},
      fitbit,
    ) as Readiness;
    expect(r.score).toBe(88);
    expect(r.band).toBe("optimal");
    expect(r.isStored).toBe(true);
  });

  it("explains the score by its weakest signal", () => {
    const base: Readiness = {
      isCalibrating: false,
      score: 60,
      band: "fair",
      hrv_score: 40,
      rhr_score: 70,
      sleep_score_used: 80,
      activity_penalty: 0,
      interaction_penalty: 0,
      hrv_baseline: 50,
      rhr_baseline: 55,
      hrv_today: 30,
      rhr_today: 58,
      data_days: 10,
    };
    expect(readinessInsight(base)).toEqual({
      lead: "moderate",
      driver: { kind: "hrvLow", today: 30, baseline: 50 },
    });
    expect(readinessInsight({ ...base, activity_penalty: 8 }).driver).toEqual({
      kind: "penalty",
      penalty: 8,
    });
    expect(readinessInsight({ ...base, hrv_score: 90, score: 85 })).toEqual({
      lead: "wellRecovered",
      driver: { kind: "allStrong" },
    });
  });

  it("maps the resilience category", () => {
    expect(resilienceCategory(3)).toBe("optimal");
    expect(resilienceCategory(1)).toBe("low");
    expect(resilienceCategory(undefined)).toBeNull();
  });
});

describe("activity and goals", () => {
  it("sums the week", () => {
    expect(
      weekActivity({
        steps: [12000, null, 8000],
        active_minutes: [30, 20.4, null],
        calories_out: [2000, null, null],
      }),
    ).toEqual({
      stepsTotal: 20000,
      stepsAvg: 10000,
      daysOver10k: 1,
      activeMinutes: 50,
      caloriesOut: 2000,
      hasData: true,
    });
  });

  it("detects goals crossed since the last load", () => {
    const goals = { steps: { min: 10000 }, floors: { min: 10 } };
    expect(crossedGoals(null, { steps: 12000, floors: 5 }, goals)).toEqual([
      "steps",
    ]);
    expect(crossedGoals({ steps: 12000 }, { steps: 13000 }, goals)).toEqual([]);
  });

  it("starts a range sync range-1 days back", () => {
    expect(syncFrom("2026-11-25", 7)).toBe("2026-11-19");
    expect(syncFrom("2026-11-25", 1)).toBe("2026-11-25");
  });
});

describe("fasting", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const fast = (id: number, start: string, end: string | null, goal = 16) => ({
    id,
    start_at: start,
    end_at: end,
    goal_hours: goal,
  });

  it("computes averages and streaks of goal-met days", () => {
    const history = [
      fast(1, "2026-11-23T20:00:00Z", "2026-11-24T12:00:00Z"),
      fast(2, "2026-11-24T20:00:00Z", "2026-11-25T12:00:00Z"),
      fast(3, "2026-11-20T20:00:00Z", "2026-11-21T04:00:00Z"),
    ];
    expect(fastingStats(history, null, now)).toEqual({
      count: 3,
      avg_hours: 13.3,
      longest_hours: 16,
      current_streak: 2,
      longest_streak: 2,
    });
    expect(fastingStats([], null, now).count).toBe(0);
  });

  it("builds 14 bars including the running fast", () => {
    const days = fastingDays([], fast(9, "2026-11-25T02:00:00Z", null), now);
    expect(days).toHaveLength(14);
    expect(days.at(-1)).toEqual({ day: "2026-11-25", hours: 10 });
  });

  it("formats a fast's length", () => {
    expect(
      formatFastDuration(
        fast(1, "2026-11-24T00:00:00Z", "2026-11-24T16:05:00Z"),
      ),
    ).toBe("16h 05m");
  });
});
