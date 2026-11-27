import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";
import { fakeFetch } from "@/test/fakeFetch";

import { AuthContext, type AuthValue } from "./AuthContext";
import { CallbackPage } from "./CallbackPage";
import { startSignIn, type SsoDeps } from "./sso";

function renderCallback(url: string, deps: SsoDeps) {
  const refresh = vi.fn(() => Promise.resolve());
  const auth: AuthValue = {
    sessions: null,
    signedOut: [],
    signIn: vi.fn(),
    signOut: vi.fn(),
    signOutFailed: [],
    refresh,
    isRedirecting: false,
    error: null,
  };
  const router = createMemoryRouter(
    [
      {
        path: "/auth/callback/:backend",
        element: <CallbackPage deps={deps} />,
      },
      { path: "*", element: <p>landed</p> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthContext value={auth}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
  return { router, refresh };
}

function makeDeps() {
  const { fetch } = fakeFetch(() => ({ body: { providers: [{ id: 1 }] } }));
  const deps = {
    fetch,
    storage: window.sessionStorage,
    navigate: vi.fn<(url: string) => void>(),
    origin: "https://trace.example.com",
  } satisfies SsoDeps;
  return deps;
}

describe("CallbackPage", () => {
  it("shows the backend's error and stops", async () => {
    await i18n.changeLanguage("en");
    const deps = makeDeps();

    renderCallback("/auth/callback/ct?oidc_error=User%20is%20disabled", deps);

    expect(
      await screen.findByText("Sign-in at CookTrace failed: User is disabled"),
    ).toBeInTheDocument();
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it("translates the backends' generic failure", async () => {
    await i18n.changeLanguage("de");
    renderCallback("/auth/callback/nt?oidc_error=callback_failed", makeDeps());

    expect(
      await screen.findByText(
        "Anmeldung bei NutriTrace fehlgeschlagen: Die Anmeldung konnte nicht abgeschlossen werden.",
      ),
    ).toBeInTheDocument();
  });

  it("hands over to the next backend after success", async () => {
    const deps = makeDeps();
    await startSignIn(["nt", "lt"], "/training", deps);
    deps.navigate.mockClear();

    renderCallback("/auth/callback/nt?oidc=ok", deps);

    await vi.waitFor(() => {
      expect(deps.navigate).toHaveBeenCalledWith(
        `/lt/api/auth/oidc/login/1?return=${encodeURIComponent("/__trace/auth/callback/lt")}`,
      );
    });
  });

  it("routes to next when the chain is done, after asking /me again", async () => {
    const deps = makeDeps();
    await startSignIn(["lt"], "/training", deps);

    const { router, refresh } = renderCallback(
      "/auth/callback/lt?oidc=ok",
      deps,
    );

    expect(await screen.findByText("landed")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/training");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
