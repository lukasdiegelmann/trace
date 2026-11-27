import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { i18n } from "@/i18n";

import { mockLtGet, renderScreen } from "../common/renderScreen";
import { ProgramDetailPage } from "./ProgramDetailPage";
import { ProgramsPage } from "./ProgramsPage";

const routes = [
  { path: "/training/programs", element: <ProgramsPage /> },
  { path: "/training/programs/:id", element: <ProgramDetailPage /> },
];

const templates = [
  { id: 11, program_id: 1, name: "Push", exercises: [] },
  { id: 12, program_id: 1, name: "Pull", exercises: [] },
];
const mine = {
  id: 1,
  name: "PPL",
  goal: "strength",
  created_by: 7,
  is_active: 1,
  duration_weeks: 6,
  current_week: 2,
  sessions_in_program: 3,
  template_count: 2,
  templates,
};

describe("program screens", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the active program's progress and creates a program", async () => {
    mockLtGet({ "/programs": [mine] });
    const create = vi
      .spyOn(api.lt, "post")
      .mockResolvedValue({ id: 5, name: "New block" });
    const user = userEvent.setup();
    const router = renderScreen(routes, "/training/programs");

    const card = await screen.findByRole("button", { name: "PPL" });
    expect(within(card).getByText("Week 2 of 6 · 3 sessions")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.type(
      await screen.findByRole("textbox", { name: "Name" }),
      "New block{Enter}",
    );

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith("/programs", {
        name: "New block",
        goal: "general",
        duration_weeks: 1,
      });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/training/programs/5");
    });
  });

  it("reorders the owner's workouts", async () => {
    mockLtGet({ "/programs/1": mine });
    const put = vi.spyOn(api.lt, "put").mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderScreen(routes, "/training/programs/1");

    await user.click(
      await screen.findByRole("button", { name: "Move Pull up" }),
    );
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith("/programs/1/reorder", {
        ids: [12, 11],
      });
    });
  });

  it("opens a coach's program without editing controls", async () => {
    mockLtGet({ "/programs/1": { ...mine, created_by: 99 } });
    renderScreen(routes, "/training/programs/1");

    expect(
      await screen.findByRole("button", { name: "Push" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add workout" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Push" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move Pull up" })).toBeNull();
  });

  it("opens a workout in the editor", async () => {
    mockLtGet({ "/programs/1": mine });
    const user = userEvent.setup();
    const router = renderScreen(
      [...routes, { path: "*", element: <p>editor</p> }],
      "/training/programs/1",
    );
    await user.click(await screen.findByRole("button", { name: "Push" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/training/programs/1/template/11",
      );
    });
  });
});
