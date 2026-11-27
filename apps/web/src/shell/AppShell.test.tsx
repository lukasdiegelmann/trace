import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthValue,
  type BackendSession,
} from "@/auth/AuthContext";
import { i18n } from "@/i18n";
import { routes } from "@/router";

const signedIn: BackendSession = {
  state: "signed-in",
  user: { id: 1, username: "lukas" },
};

function renderAt(path: string, auth: Partial<AuthValue>) {
  const value: AuthValue = {
    sessions: { nt: signedIn, ct: signedIn, lt: signedIn },
    signedOut: [],
    signIn: vi.fn(),
    signOut: vi.fn(),
    signOutFailed: [],
    refresh: vi.fn(),
    isRedirecting: false,
    error: null,
    ...auth,
  };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthContext value={value}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
  return router;
}

describe("AppShell", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("sends / to nutrition and shows the three domains in the navigation", async () => {
    const router = renderAt("/", {});

    expect(
      await screen.findByRole("heading", { name: "Nutrition" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/nutrition");
    for (const label of ["Nutrition", "Cooking", "Training", "Settings"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("shows the sign-in page while a backend is signed out", async () => {
    renderAt("/training", {
      sessions: {
        nt: signedIn,
        ct: { state: "signed-out", isExpired: false },
        lt: signedIn,
      },
      signedOut: ["ct"],
    });

    expect(
      await screen.findByRole("heading", { name: "Sign in to Trace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Still to sign in: CookTrace")).toBeInTheDocument();
  });

  it("warns about a backend that can't be reached", async () => {
    renderAt("/cooking", {
      sessions: { nt: signedIn, ct: signedIn, lt: { state: "unavailable" } },
    });

    expect(
      await screen.findByText(
        "LiftTrace can't be reached right now. Its sections may not work.",
      ),
    ).toBeInTheDocument();
  });

  it("answers an unknown path inside the shell", async () => {
    renderAt("/nowhere", {});
    expect(
      await screen.findByText("This page doesn't exist."),
    ).toBeInTheDocument();
  });
});
