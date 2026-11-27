import { ToastProvider } from "@monocircuit/monolithium/components";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as ai from "@/features/shared/ai";
import { setLanguage } from "@/i18n";

import { resetDiaryStore } from "../diary/diaryStore";
import { localDateStr } from "../lib/dates";
import { fakeLt } from "./fakeLt";
import { TrainingSmartLog } from "./SmartLog";

beforeEach(() => {
  setLanguage("en");
  resetDiaryStore();
  vi.spyOn(ai, "loadAiSetup").mockResolvedValue(
    ai.aiSetup({ aiEnabled: true, aiApiKey: "key" }, {}),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});

function show(onClose = vi.fn()) {
  render(
    <ToastProvider>
      <TrainingSmartLog text="bench 2x5 at 100, yoke" onClose={onClose} />
    </ToastProvider>,
  );
  return onClose;
}

describe("Smart Log", () => {
  it("reads, lets the user review and saves into the diary's day", async () => {
    const user = userEvent.setup();
    const server = fakeLt({
      "/exercises": [{ id: 2, name: "Bench Press" }],
    });
    server.rows.push({
      id: 1,
      date: localDateStr(),
      name: "Push",
      exercises: [{ uuid: "old", exercise_name: "Dips", sets: [] }],
    });
    vi.spyOn(ai, "askAi").mockResolvedValue(
      JSON.stringify({
        exercises: [
          {
            name: "bench",
            sets: [
              { reps: 5, weight: 100 },
              { reps: 5, weight: 100 },
            ],
          },
          { name: "yoke", sets: [{ reps: 1, weight: 200 }] },
        ],
      }),
    );
    const onClose = show();

    await user.click(await screen.findByRole("checkbox", { name: "yoke" }));
    const reps = screen.getByRole("textbox", {
      name: "Bench Press, set 2: reps",
    });
    await user.clear(reps);
    await user.type(reps, "3");
    await user.click(screen.getByRole("button", { name: "Add to workout" }));

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(server.rows[0]?.name).toBe("Push");
    expect(server.rows[0]?.exercises).toMatchObject([
      { exercise_name: "Dips" },
      {
        exercise_id: 2,
        exercise_name: "Bench Press",
        sets: [{ reps: 5 }, { reps: 3 }],
      },
    ]);
    expect(server.rows[0]?.exercises).toHaveLength(2);
  });

  it("keeps the words to change when nothing can be read", async () => {
    fakeLt();
    vi.spyOn(ai, "askAi").mockResolvedValue("no idea");
    show();
    expect(
      await screen.findByText(/Could not understand that/),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("bench 2x5 at 100, yoke")).toBeVisible();
  });
});
