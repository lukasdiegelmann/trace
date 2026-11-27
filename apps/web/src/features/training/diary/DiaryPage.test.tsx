import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { AuthContext, type AuthValue } from "@/auth/AuthContext";
import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";

import { localDateStr } from "../lib/dates";
import { restTimer, stopRest } from "../lib/restTimer";
import type { WorkoutLog } from "../lib/workoutTypes";
import { DiaryPage } from "./DiaryPage";
import { resetDiaryStore } from "./diaryStore";

const TODAY = localDateStr();

const auth: AuthValue = {
  sessions: {
    nt: { state: "unavailable" },
    ct: { state: "unavailable" },
    lt: { state: "signed-in", user: { id: 1, username: "test" } },
  },
  signedOut: [],
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  refresh: () => Promise.resolve(),
  isRedirecting: false,
  error: null,
  signOutFailed: [],
};

let workout: WorkoutLog | null;
let settings: Record<string, unknown>;

function answer(path: string, query?: Record<string, unknown>): unknown {
  if (path === "/settings") return settings;
  // Any day: the calendar test opens a fixed one, which is not always today
  if (/^\/workout\/\d{4}-\d{2}-\d{2}$/.test(path)) return { workout };
  if (/^\/workout\/\d{4}-\d{2}-\d{2}\/sessions$/.test(path)) {
    return { sessions: workout ? [workout] : [] };
  }
  if (path.endsWith("/feedback")) return [];
  if (path === "/workout/recent") return query ? [] : [];
  if (path.startsWith("/workout/history/")) {
    return [
      {
        date: "2026-01-02",
        sets: [{ weight: 100, reps: 5, completed: true }],
      },
    ];
  }
  if (path.startsWith("/prescriptions/my/upcoming")) return [];
  if (path.startsWith("/prescriptions/my/")) return null;
  if (path === "/programs") return [];
  if (path === "/coach-feedback/unread-dates") return [];
  if (path === "/set-media") return { media: [] };
  if (path.startsWith("/body-stats/")) return { stats: null };
  if (path === "/exercises") return [];
  if (path === "/exercises/7") return { id: 7, name: "Bench Press" };
  return [];
}

function renderDiary(url = "/training") {
  const router = createMemoryRouter(
    [{ path: "/training", element: <DiaryPage /> }],
    { initialEntries: [url] },
  );
  render(
    <ZLayerProvider>
      <ToastProvider>
        <AuthContext.Provider value={auth}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </ToastProvider>
    </ZLayerProvider>,
  );
  return router;
}

describe("DiaryPage", () => {
  const saved: WorkoutLog[] = [];

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    saved.length = 0;
    workout = null;
    settings = { weightUnit: "kg", restTimerEnabled: true, restDuration: 60 };
    resetDiaryStore();
    vi.spyOn(api.lt, "get").mockImplementation(
      (path: string, options?: { query?: Record<string, unknown> }) =>
        Promise.resolve(answer(path, options?.query)),
    );
    vi.spyOn(api.lt, "put").mockImplementation(((
      path: string,
      body: WorkoutLog,
    ) => {
      if (path.startsWith("/workout/")) {
        workout = { ...body, id: 1, date: TODAY };
        saved.push(workout);
        return Promise.resolve({ workout });
      }
      return Promise.resolve({ ok: true });
    }) as typeof api.lt.put);
    vi.spyOn(api.lt, "post").mockImplementation(() =>
      Promise.resolve({ ok: true }),
    );
    await settingsStores.lt.reload();
  });

  afterEach(() => {
    stopRest(false);
    vi.restoreAllMocks();
  });

  it("offers to load or add on an empty day", async () => {
    renderDiary();
    expect(await screen.findByText("Ready to train?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add exercise" }),
    ).toBeInTheDocument();
  });

  it("ticks a set: saves it and starts the rest timer", async () => {
    workout = {
      id: 1,
      date: TODAY,
      name: "Test",
      exercises: [
        {
          uuid: "e1",
          exercise_id: 7,
          exercise_name: "Bench Press",
          sets: [
            { uuid: "s1", weight: 105, reps: 5, completed: false },
            { uuid: "s2", weight: 105, reps: 5, completed: false },
          ],
        },
      ],
    };
    renderDiary();
    const user = userEvent.setup();
    expect(
      await screen.findByRole("button", { name: /^Bench Press:/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText("100×5")).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: "Mark set 1 complete" })[0],
    );
    await waitFor(() => {
      expect(saved.at(-1)?.exercises[0].sets?.[0].completed).toBe(true);
    });
    expect(restTimer.get()).toMatchObject({ total: 60, exerciseId: 7 });
    expect(await screen.findByText("PR")).toBeInTheDocument();
  });

  it("opens the set number menu and renumbers the round", async () => {
    workout = {
      id: 1,
      date: TODAY,
      name: "Test",
      exercises: [
        {
          uuid: "e1",
          exercise_name: "Row",
          sets: [{ uuid: "s1", weight: 50, reps: 8, completed: false }],
        },
      ],
    };
    renderDiary();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: "Set number 1: change the round",
      }),
    );
    const menu = await screen.findByRole("menu");
    await user.click(within(menu).getByText("Round 3"));
    await waitFor(() => {
      expect(saved.at(-1)?.exercises[0].sets?.[0].number).toBe(3);
    });
  });

  it("types a weight without losing the text", async () => {
    workout = {
      id: 1,
      date: TODAY,
      name: "Test",
      exercises: [
        {
          uuid: "e1",
          exercise_name: "Row",
          sets: [{ uuid: "s1", weight: 50, reps: 8, completed: false }],
        },
      ],
    };
    renderDiary();
    const user = userEvent.setup();
    const weight = await screen.findByRole("textbox", {
      name: "Weight in kg, set 1",
    });
    await user.click(weight);
    await user.keyboard("62.5");
    expect(weight).toHaveValue("62.5");
    await waitFor(() => {
      expect(saved.at(-1)?.exercises[0].sets?.[0].weight).toBe(62.5);
    });
  });

  it("jumps the calendar to another month", async () => {
    renderDiary("/training?date=2026-11-26");
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /^Jump to a date:/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Month: November" }),
    );
    await user.click(
      within(await screen.findByRole("menu")).getByText("March"),
    );
    expect(
      await screen.findByRole("button", { name: "Month: March" }),
    ).toBeInTheDocument();
  });

  it("goes to the previous day", async () => {
    const router = renderDiary();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Previous day" }),
    );
    expect(router.state.location.search).toMatch(/\?date=\d{4}-\d{2}-\d{2}/);
  });

  it("adds the exercise the exercise page asked for, once", async () => {
    const router = renderDiary("/training?addExercise=7");
    await waitFor(
      () => {
        expect(saved.at(-1)?.exercises).toHaveLength(1);
      },
      { timeout: 3000 },
    );
    expect(saved.at(-1)?.exercises[0]?.exercise_name).toBe("Bench Press");
    expect(router.state.location.search).toBe("");
  });
});
