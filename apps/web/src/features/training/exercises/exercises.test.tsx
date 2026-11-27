import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { i18n } from "@/i18n";

import { mockLtGet, renderScreen } from "../common/renderScreen";
import { ExerciseDetailPage } from "./ExerciseDetailPage";
import { ExercisesPage } from "./ExercisesPage";

const bench = {
  id: 1,
  name: "Bench Press",
  category: "chest",
  equipment: ["Barbell"],
  primary_muscles: ["chest"],
  is_global: 1,
};
const mine = {
  id: 2,
  name: "My Curl",
  category: "arms",
  equipment: ["Dumbbell"],
  primary_muscles: ["biceps"],
  source: "custom",
  is_global: 0,
  created_by: 7,
};

const routes = [
  { path: "/training/exercises", element: <ExercisesPage /> },
  { path: "/training/exercises/:id", element: <ExerciseDetailPage /> },
];

describe("exercise screens", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the library by category, searches and opens an exercise", async () => {
    mockLtGet({
      "/exercises": [bench, mine],
      "/exercises/usage": {},
      "/exercises/1": bench,
      "/workout/history/1": [
        {
          date: "2026-01-05",
          sets: [{ weight: 100, reps: 5, completed: true }],
        },
      ],
    });
    const user = userEvent.setup();
    const router = renderScreen(routes, "/training/exercises");

    expect(
      await screen.findByRole("button", { name: "Bench Press" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Arms" })).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: "Search exercises" }),
      "bench",
    );
    expect(screen.queryByRole("button", { name: "My Curl" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Bench Press" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/training/exercises/1");
    });
    expect(await screen.findByText("Personal record")).toBeInTheDocument();
    // A library exercise can be shared, not changed.
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("deletes the user's own exercise after a confirmation", async () => {
    mockLtGet({
      "/exercises": [mine],
      "/exercises/2": mine,
      "/workout/history/2": [],
    });
    const remove = vi.spyOn(api.lt, "delete").mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const router = renderScreen(routes, "/training/exercises/2");

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Delete “My Curl”?")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith("/exercises/2");
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/training/exercises");
    });
  });

  it("opens the editor from the add menu", async () => {
    mockLtGet({ "/exercises": [bench], "/exercises/usage": {} });
    const create = vi
      .spyOn(api.lt, "post")
      .mockResolvedValue({ id: 3, name: "Sled push" });
    const user = userEvent.setup();
    renderScreen(routes, "/training/exercises");

    await screen.findByRole("button", { name: "Bench Press" });
    await user.click(screen.getByRole("button", { name: "Add exercise" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Create new" }),
    );
    await user.type(
      await screen.findByRole("textbox", { name: "Name" }),
      "Sled push",
    );
    await user.click(screen.getByRole("button", { name: "Legs" }));
    await user.click(screen.getByRole("button", { name: "Create exercise" }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        "/exercises",
        expect.objectContaining({ name: "Sled push", category: "legs" }),
      );
    });
  });

  it("says why an exercise didn't load", async () => {
    mockLtGet({ "/exercises/9": new Error("Exercise not found") });
    renderScreen(routes, "/training/exercises/9");
    expect(
      await screen.findByText(
        "Could not load this exercise: Exercise not found",
      ),
    ).toBeInTheDocument();
  });

  it("explains an empty library", async () => {
    mockLtGet({ "/exercises": [], "/exercises/usage": {} });
    renderScreen(routes, "/training/exercises");
    expect(
      await screen.findByText(/Your library is empty/),
    ).toBeInTheDocument();
  });
});
