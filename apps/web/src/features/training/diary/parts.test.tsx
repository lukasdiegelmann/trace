import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { i18n } from "@/i18n";

import { CardioCard } from "./CardioCard";
import { GymToolsPanel } from "./GymTools";
import { LoadWorkoutSheet } from "./LoadWorkoutSheet";
import { WorkoutSummarySheet } from "./WorkoutSummarySheet";

const show = (element: ReactElement) =>
  render(
    <ZLayerProvider>
      <ToastProvider>{element}</ToastProvider>
    </ZLayerProvider>,
  );

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("gym tools", () => {
  it("loads the bar and converts", async () => {
    show(<GymToolsPanel unit="kg" />);
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Target weight (kg)" }),
      "100",
    );
    expect(screen.getByText("1 × 25 kg")).toBeInTheDocument();
    expect(screen.getByText("1 × 15 kg")).toBeInTheDocument();
    await user.click(screen.getByText("Convert"));
    await user.type(screen.getByRole("textbox", { name: "Pounds" }), "225");
    expect(screen.getByText("102.06 kg")).toBeInTheDocument();
  });
});

describe("cardio card", () => {
  it("validates and logs a session", async () => {
    vi.spyOn(api.lt, "get").mockResolvedValue([]);
    const post = vi.spyOn(api.lt, "post").mockResolvedValue({
      id: 1,
      date: "2026-11-26",
      activity: "Row",
      duration_min: 20,
      distance: null,
      distance_unit: "mi",
      avg_hr: null,
      notes: null,
    });
    const onChange = vi.fn();
    show(<CardioCard date="2026-11-26" onChange={onChange} />);
    const user = userEvent.setup();
    expect(
      await screen.findByText("No cardio logged for this day."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Add cardio session" }),
    );
    await user.click(screen.getByRole("button", { name: "Log" }));
    expect(await screen.findByText("Activity required")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Activity" }), "Row");
    await user.type(screen.getByRole("textbox", { name: "Minutes" }), "20");
    await user.click(screen.getByRole("button", { name: "Log" }));
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        "/cardio",
        expect.objectContaining({ activity: "Row", duration_min: 20 }),
      );
    });
    expect(onChange).toHaveBeenCalled();
  });
});

describe("workout summary", () => {
  it("sums the session and sets a duration", async () => {
    const onDurationChange = vi.fn();
    show(
      <WorkoutSummarySheet
        isOpen
        onOpenChange={() => undefined}
        workout={{
          name: "Push",
          date: "2026-11-26",
          exercises: [
            {
              exercise_name: "Bench Press",
              sets: [{ weight: 100, reps: 10, completed: true }],
            },
          ],
        }}
        prCount={1}
        streak={3}
        timerMinutes={null}
        onDurationChange={onDurationChange}
        profile={{ weight_kg: null, height_cm: null, age: null }}
      />,
    );
    const user = userEvent.setup();
    expect(await screen.findByText("1 new PR")).toBeInTheDocument();
    expect(screen.getByText("100×10")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Change the duration" }),
    );
    await user.click(screen.getByRole("button", { name: "45 m" }));
    expect(onDurationChange).toHaveBeenCalledWith(45);
  });
});

describe("load workout", () => {
  it("lists the active program's workouts and moves its week", async () => {
    const program = {
      id: 3,
      name: "Block",
      is_active: 1,
      duration_weeks: 4,
      current_week: 2,
      templates: [
        {
          id: 9,
          name: "Day A",
          exercises: [
            { exercise_name: "Squat", target_sets: 3, target_reps: "5" },
          ],
        },
      ],
    };
    vi.spyOn(api.lt, "get").mockImplementation((path: string) =>
      Promise.resolve(path === "/programs" ? [program] : program),
    );
    const post = vi.spyOn(api.lt, "post").mockResolvedValue({});
    const onLoad = vi.fn();
    show(
      <LoadWorkoutSheet
        isOpen
        onClose={() => undefined}
        unit="kg"
        onLoad={onLoad}
      />,
    );
    const user = userEvent.setup();
    expect(await screen.findByText("Week 2 of 4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Advance a week" }));
    expect(post).toHaveBeenCalledWith("/programs/3/week-cursor", { week: 3 });
    await user.click(
      screen.getByRole("button", { name: "Show details of Day A" }),
    );
    expect(await screen.findByText("3×5")).toBeInTheDocument();
  });
});
