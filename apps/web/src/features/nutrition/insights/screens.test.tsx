import { ToastProvider } from "@monocircuit/monolithium/components";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";

import { addDays, localDateStr } from "../lib/insights/dates";
import { BodyStatsSettingsPage } from "./settings/BodyStatsSettingsPage";
import { StatisticsSettingsPage } from "./settings/StatisticsSettingsPage";
import { WellnessSettingsPage } from "./settings/WellnessSettingsPage";
import { StartRedirect } from "./StartRedirect";
import { StatisticsPage } from "./statistics/StatisticsPage";
import { WellnessPage } from "./wellness/WellnessPage";

const today = localDateStr();
const yesterday = addDays(today, -1);

interface Backend {
  settings: Record<string, unknown>;
  responses?: Record<string, unknown>;
}

/** A NutriTrace that answers reads from a table and records writes */
function backend({ settings, responses = {} }: Backend) {
  const answers: Record<string, unknown> = {
    "/settings": settings,
    "/diary": [
      {
        date: yesterday,
        items: [{ quantity: 2, nutrition: { calories: 900, proteins: 40 } }],
        water: [{ amount: 500 }],
        body_stats: { weight: 81.5, weight_unit: "kg" },
      },
    ],
    "/wellness/fitbit/status": { connected: false, configured: false },
    "/wellness/google-health/status": { connected: false, configured: false },
    "/wellness/withings/status": { connected: false, configured: false },
    "/wellness/garmin/status": { connected: false, configured: false },
    "/wellness/fitbit/data": {},
    "/wellness/garmin/data": {},
    "/wellness/withings/data": {},
    "/wellness/fitbit/workouts": [],
    "/fasts/active": null,
    "/fasts": [],
    ...responses,
  };
  vi.spyOn(api.nt, "get").mockImplementation((path: string) =>
    Promise.resolve((path in answers ? answers[path] : {}) as never),
  );
  return {
    put: vi.spyOn(api.nt, "put").mockResolvedValue({ ok: true }),
    post: vi.spyOn(api.nt, "post").mockResolvedValue({ ok: true }),
  };
}

async function show(element: React.ReactElement, url = "/") {
  await settingsStores.nt.reload();
  const router = createMemoryRouter([{ path: "*", element }], {
    initialEntries: [url],
  });
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return router;
}

/** No `insights.…` key may reach the screen */
function expectNoRawKeys() {
  expect(document.body.textContent).not.toContain("insights.");
  for (const element of document.querySelectorAll("[aria-label], [title]")) {
    const text = `${element.getAttribute("aria-label")} ${element.getAttribute("title")}`;
    expect(text).not.toContain("insights.");
  }
}

describe("statistics screen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("summarizes the diary and lists the history", async () => {
    backend({ settings: { weightUnit: "kg", dateFormat: "ISO" } });
    await show(<StatisticsPage />);

    expect(
      await screen.findByRole("button", {
        name: `Open ${yesterday} in the diary`,
      }),
    ).toHaveTextContent("1,800 kcal");
    expect(screen.getAllByText("Average").length).toBeGreaterThan(0);
    expectNoRawKeys();
  });

  it("opens the metric of a deep link and drills into the diary", async () => {
    backend({ settings: { weightUnit: "kg", dateFormat: "ISO" } });
    const router = await show(<StatisticsPage />, "/?metric=weight&range=7");

    const row = await screen.findByRole("button", {
      name: `Open ${yesterday} in the diary`,
    });
    expect(row).toHaveTextContent("81.5 kg");
    await userEvent.click(row);
    expect(router.state.location.pathname).toBe("/nutrition/diary");
    expect(router.state.location.search).toBe(`?date=${yesterday}`);
  });

  it("saves an overlay toggle to the shared setting", async () => {
    const { put } = backend({ settings: {} });
    await show(<StatisticsPage />);

    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Trend" }),
    );
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith("/settings", {
        key: "statsTrendLine",
        value: false,
      });
    });
  });

  it("shows fasting insights when fasting is on", async () => {
    backend({ settings: { fastingEnabled: true } });
    await show(<StatisticsPage />);
    expect(await screen.findByText("Fasting insights")).toBeInTheDocument();
    expectNoRawKeys();
  });
});

describe("wellness screen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de");
  });

  it("invites to connect when nothing is enabled", async () => {
    backend({ settings: {} });
    await show(<WellnessPage />);
    expect(
      await screen.findByText("Keine Verbindung aktiviert"),
    ).toBeInTheDocument();
    expectNoRawKeys();
  });

  it("shows the day's metrics, sleep and readiness of a connected Fitbit", async () => {
    const history = Object.fromEntries(
      [0, 1, 2, 3, 4, 5].map((ago) => [
        addDays(today, -ago),
        {
          steps: 12345,
          sleep_duration_min: 450,
          sleep_deep_min: 80,
          sleep_rem_min: 90,
          sleep_light_min: 260,
          sleep_wake_min: 20,
          sleep_start_min: 1380,
          sleep_end_min: 420,
          hrv_daily_rmssd: 40,
          resting_hr: 55,
          resilience_category: 3,
          resilience_score: 82,
        },
      ]),
    );
    const { post } = backend({
      settings: { fitbitEnabled: true, fitbitSyncMode: "manual" },
      responses: {
        "/wellness/fitbit/status": { connected: true, configured: true },
        "/wellness/fitbit/data": history,
      },
    });
    await show(<WellnessPage />);

    expect((await screen.findAllByText("12.345")).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Schlaf" }));
    expect(await screen.findByText("Schlafphasen")).toBeInTheDocument();
    expect(screen.getByText("Schlafdefizit")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Herz" }));
    expect(await screen.findByText("Tagesform")).toBeInTheDocument();
    expect(screen.getByText("Resilienz")).toBeInTheDocument();
    expectNoRawKeys();
    // "manual": nothing syncs by itself
    expect(post).not.toHaveBeenCalled();
  });

  it("syncs a connected Fitbit on request", async () => {
    const { post } = backend({
      settings: {
        fitbitEnabled: true,
        fitbitSyncMode: "manual",
        wellnessSyncRange: 7,
      },
      responses: {
        "/wellness/fitbit/status": { connected: true, configured: true },
      },
    });
    await show(<WellnessPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Fitbit synchronisieren" }),
    );
    expect(post).toHaveBeenCalledWith(
      "/wellness/fitbit/sync",
      { from: addDays(today, -6), to: today },
      { shouldVerify401: true },
    );
  });
});

describe("settings screens", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reorders the body stats", async () => {
    const { put } = backend({ settings: {} });
    await show(<BodyStatsSettingsPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Move Neck up" }),
    );
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith("/settings", {
        key: "bodyStatsOrder",
        value: expect.arrayContaining(["neck", "weight"]) as unknown,
      });
    });
    expectNoRawKeys();
  });

  it("lists the statistics options and metrics", async () => {
    backend({ settings: {} });
    await show(<StatisticsSettingsPage />);
    expect(
      await screen.findByRole("checkbox", { name: "Include today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Calories" }),
    ).toBeInTheDocument();
    expectNoRawKeys();
  });

  it("offers the credentials form for an enabled provider", async () => {
    backend({
      settings: {
        wellnessEnabled: true,
        fitbitEnabled: true,
        garminEnabled: true,
        withingsEnabled: true,
        healthConnectEnabled: true,
        fitbitSyncMode: "scheduled",
        garminSyncMode: "scheduled",
        garminSyncInterval: 60,
      },
    });
    await show(<WellnessSettingsPage />);
    expect(await screen.findAllByText("API credentials")).toHaveLength(3);
    expect(screen.getByText("Health Connect")).toBeInTheDocument();
    expectNoRawKeys();
  });
});

describe("start redirect", () => {
  it("takes a wearable's OAuth return to Wellness", async () => {
    const router = await showRedirect("/?google_health=connected");
    expect(router.state.location.pathname).toBe("/nutrition/wellness");
    expect(router.state.location.search).toBe("?google_health=connected");
  });

  it("otherwise leads to nutrition", async () => {
    const router = await showRedirect("/");
    expect(router.state.location.pathname).toBe("/nutrition");
  });

  async function showRedirect(url: string) {
    const router = createMemoryRouter(
      [
        { path: "/", element: <StartRedirect /> },
        { path: "*", element: null },
      ],
      { initialEntries: [url] },
    );
    render(<RouterProvider router={router} />);
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe("/");
    });
    return router;
  }
});
