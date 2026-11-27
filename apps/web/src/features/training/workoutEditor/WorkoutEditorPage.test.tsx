import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { AuthContext, type AuthValue } from "@/auth/AuthContext";

import { WorkoutEditorPage } from "./WorkoutEditorPage";

const auth: AuthValue = {
  sessions: {
    nt: { state: "unavailable" },
    ct: { state: "unavailable" },
    lt: { state: "signed-in", user: { id: 1 } },
  },
  signedOut: [],
  signIn: vi.fn(),
  signOut: vi.fn(),
  refresh: vi.fn(),
  isRedirecting: false,
  error: null,
  signOutFailed: [],
};

function open(makerId: number) {
  vi.spyOn(api.lt, "get").mockImplementation((path: string) => {
    if (path === "/templates/5") {
      return Promise.resolve({
        id: 5,
        name: "Push day",
        duration_weeks: 2,
        exercises: [
          {
            uuid: "a",
            exercise_id: 1,
            exercise_name: "Bench Press",
            target_sets: 3,
            target_reps: "8",
          },
        ],
      });
    }
    if (path === "/programs/2") {
      return Promise.resolve({ id: 2, name: "P", created_by: makerId });
    }
    return Promise.resolve({});
  });
  const router = createMemoryRouter(
    [
      {
        path: "/training/programs/:programId/templates/:templateId",
        element: <WorkoutEditorPage />,
      },
      { path: "/training/programs/:programId", element: <p>The program</p> },
    ],
    { initialEntries: ["/training/programs/2/templates/5"] },
  );
  render(
    <AuthContext value={auth}>
      <ZLayerProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ZLayerProvider>
    </AuthContext>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WorkoutEditorPage", () => {
  it("asks before leaving with changes", async () => {
    open(1);
    const name = await screen.findByDisplayValue("Push day");
    fireEvent.change(name, { target: { value: "Pull day" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Back to the program" }),
    );
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByText("The program")).toBeInTheDocument();
  });

  it("saves with the deleted uuids and returns to the program", async () => {
    const put = vi.spyOn(api.lt, "put").mockResolvedValue({});
    open(1);
    fireEvent.click(
      await screen.findByRole("button", { name: "Options for Bench Press" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete exercise" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith("/templates/5", {
        name: "Push day",
        exercises: [],
        deleted_uuids: { exercises: ["a"], sets: {} },
      });
    });
    expect(await screen.findByText("The program")).toBeInTheDocument();
  });

  it("keeps the load menu open for Remember, then picks and saves", async () => {
    const put = vi.spyOn(api.lt, "put").mockResolvedValue({});
    open(1);
    fireEvent.click(
      await screen.findByRole("button", { name: "Load type of Bench Press" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitemradio", {
        name: /Remember for this exercise/,
      }),
    );
    expect(
      screen.getByRole("menuitemradio", { name: /Remember for/ }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Per side/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(
        "/templates/5",
        expect.objectContaining({
          exercises: [expect.objectContaining({ load_type: "paired" })],
        }),
      );
    });
  });

  it("copies a week and switches to it", async () => {
    open(1);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Copy Week 1 into Week 2",
      }),
    );
    expect(screen.getByRole("button", { name: "Week 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByDisplayValue("8")).toBeInTheDocument();
  });

  it("is read only in someone else's program", async () => {
    open(99);
    const name = await screen.findByDisplayValue("Push day");
    expect(name).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Notes")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("8")).toHaveAttribute("readonly");
    for (const gone of ["Save", "Add Exercise", "Options for Bench Press"]) {
      expect(
        screen.queryByRole("button", { name: gone }),
      ).not.toBeInTheDocument();
    }
  });
});
