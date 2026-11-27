import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";

import { BODY_STATS_SAVED } from "../common/events";
import { mockLtGet, renderScreen } from "../common/renderScreen";
import { localDay } from "../lib/statistics";
import { StatisticsPage } from "./StatisticsPage";

const routes = [{ path: "/training/statistics", element: <StatisticsPage /> }];
const today = localDay();

const answers = {
  "/exercises": [{ id: 1, name: "Bench", category: "chest" }],
  "/stats/earliest-workout-date": { date: "2025-01-01" },
  "/stats/volume": [{ week: "2026-03-09", volume: 4800 }],
  "/stats/frequency": [{ week: "2026-03-09", count: 3 }],
  "/stats/records": [
    {
      exerciseId: 1,
      name: "Bench",
      maxWeight: 100,
      maxReps: 5,
      e1rm: 117,
      date: "2026-03-09",
    },
  ],
  "/stats/streaks": { currentStreak: 2, longestStreak: 9, totalWorkouts: 40 },
  "/stats/muscle-effective-sets": { chest: 6, biceps: 2.4 },
  "/stats/weekday-distribution": [{ day: 1, count: 3 }],
  "/cardio/stats/weekly": [],
  "/cardio": [],
  "/workout/recent": [
    {
      date: today,
      completed: 1,
      exercises: [{ sets: [{ weight: 100, reps: 5, completed: true }] }],
    },
  ],
  "/body-stats/range": [
    { date: "2026-03-01", stats: { weight: 82, waist: 90 } },
    { date: "2026-03-09", stats: { weight: 81, waist: 89 } },
  ],
};

describe("statistics screen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens on the linked range with the overview", async () => {
    const get = mockLtGet(answers);
    renderScreen(routes, "/training/statistics?range=1W");

    expect(await screen.findByText("1 of 4 this week")).toBeInTheDocument();
    expect(screen.getByText("40 total workouts")).toBeInTheDocument();
    expect(screen.getByText("9 days")).toBeInTheDocument();
    const call = get.mock.calls.find(([path]) => path === "/stats/volume");
    const query = call?.[1]?.query as { start: string; end: string };
    const days = (Date.parse(query.end) - Date.parse(query.start)) / 86400000;
    expect(days).toBe(7);
  });

  it("shows records and the weight history behind their metrics", async () => {
    mockLtGet(answers);
    const user = userEvent.setup();
    renderScreen(routes, "/training/statistics");

    await screen.findByText("1 of 4 this week");
    await user.click(screen.getByText("Records"));
    expect(await screen.findByText(/Est\. 1RM 117 lbs/)).toBeInTheDocument();

    await user.click(screen.getByText("Weight"));
    expect(
      await screen.findByRole("button", { name: "Progress photos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waist" })).toBeInTheDocument();
    expect(screen.getByText("-1 lbs")).toBeInTheDocument();
  });

  it("names a failed statistic instead of showing zeros", async () => {
    mockLtGet({ ...answers, "/stats/streaks": new Error("boom") });
    renderScreen(routes, "/training/statistics");

    expect(
      await screen.findByText("Some statistics could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Longest streak")).toBeNull();
    expect(screen.getByText("1 of 4 this week")).toBeInTheDocument();
  });

  it("loads again after body stats were saved", async () => {
    const get = mockLtGet(answers);
    renderScreen(routes, "/training/statistics");
    await screen.findByText("1 of 4 this week");
    const before = get.mock.calls.filter(
      ([path]) => path === "/body-stats/range",
    ).length;

    window.dispatchEvent(new CustomEvent(BODY_STATS_SAVED));

    await waitFor(() => {
      expect(
        get.mock.calls.filter(([path]) => path === "/body-stats/range").length,
      ).toBe(before + 1);
    });
  });
});
