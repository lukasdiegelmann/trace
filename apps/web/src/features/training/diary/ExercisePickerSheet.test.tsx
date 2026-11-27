import { ToastProvider } from "@monocircuit/monolithium/components";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";

import { ExercisePickerSheet } from "./ExercisePickerSheet";

const exercises = [
  { id: 1, name: "Bench Press", category: "chest", equipment: ["barbell"] },
  { id: 2, name: "Squat", category: "legs", equipment: ["barbell"] },
];

function mockGet() {
  return vi
    .spyOn(api.lt, "get")
    .mockImplementation(<T,>(path: string) =>
      Promise.resolve(
        (path === "/exercises"
          ? exercises
          : path === "/settings"
            ? {}
            : []) as T,
      ),
    );
}

function renderPicker(onSelect = vi.fn()) {
  render(
    <ToastProvider>
      <ExercisePickerSheet isOpen onOpenChange={vi.fn()} onSelect={onSelect} />
    </ToastProvider>,
  );
  return onSelect;
}

describe("ExercisePickerSheet", () => {
  beforeEach(() => {
    mockGet();
  });

  it("filters by a trimmed search and selects, staying open", async () => {
    const onSelect = renderPicker();
    await screen.findByText("Squat");

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search exercises" }),
      { target: { value: "bench " } },
    );
    expect(screen.queryByText("Squat")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Bench Press" }));
    expect(onSelect).toHaveBeenCalledWith(exercises[0]);
    expect(screen.getByText("✓ Added")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create “bench”" }),
    ).toBeInTheDocument();
  });

  it("filters by category and keeps the filter", async () => {
    renderPicker();
    await screen.findByText("Bench Press");

    fireEvent.click(screen.getByRole("button", { name: "Legs" }));
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.sessionStorage.getItem("lt:picker-filters")).toContain(
        '"category":"legs"',
      );
    });
  });

  it("creates what the search doesn't find, and selects it", async () => {
    const created = { id: 9, name: "Zercher Carry" };
    const post = vi.spyOn(api.lt, "post").mockResolvedValue(created);
    const onSelect = renderPicker();
    await screen.findByText("Squat");

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search exercises" }),
      { target: { value: "Zercher Carry" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create “Zercher Carry”" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create exercise" }),
    );

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(created);
    });
    expect(post).toHaveBeenCalledWith(
      "/exercises",
      expect.objectContaining({ name: "Zercher Carry", load_type: null }),
    );
  });
});
