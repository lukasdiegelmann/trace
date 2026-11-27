/** Shared by this folder's component tests */
import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";

import { api, ApiError, type HttpMethod } from "@/api";
import { AuthContext, type AuthValue } from "@/auth/AuthContext";
import { i18n } from "@/i18n";

import { CoachingPage } from "./CoachingPage";
import { CoachPage } from "./CoachPage";
import type { CoachingState } from "./api";
import { coachingStore } from "./coachingStore";

export const ME = 1;

export const coachingState = (
  patch: Partial<CoachingState> = {},
): CoachingState => ({
  role: "member",
  can_coach: false,
  as_client: null,
  requests: [],
  past: [],
  as_coach: { pending: 0, active: 0, recent: 0 },
  unread: 0,
  awaiting: 0,
  ...patch,
});

/** What each `METHOD /path` answers; a function gets the body */
export type Routes = Record<string, unknown>;

export function mockApi(routes: Routes) {
  const answer = (method: HttpMethod, path: string, body?: unknown) => {
    const key = `${method} ${path}`;
    if (!(key in routes)) {
      // The settings store asks on its own.
      if (path === "/settings") return Promise.resolve({});
      return Promise.reject(new ApiError("lt", 404, { error: key }));
    }
    const value = routes[key];
    // A function may throw: that is the answer's rejection.
    return new Promise((resolve) => {
      resolve(
        typeof value === "function"
          ? (value as (input: unknown) => unknown)(body)
          : value,
      );
    });
  };
  return {
    get: vi
      .spyOn(api.lt, "get")
      .mockImplementation((path) => answer("GET", path)),
    post: vi
      .spyOn(api.lt, "post")
      .mockImplementation((path, body) => answer("POST", path, body)),
    put: vi
      .spyOn(api.lt, "put")
      .mockImplementation((path, body) => answer("PUT", path, body)),
    delete: vi
      .spyOn(api.lt, "delete")
      .mockImplementation((path) => answer("DELETE", path)),
  };
}

export async function renderCoaching(url: string) {
  await i18n.changeLanguage("en");
  coachingStore.reset();
  const user = { id: ME };
  const auth: AuthValue = {
    sessions: {
      nt: { state: "signed-in", user },
      ct: { state: "signed-in", user },
      lt: { state: "signed-in", user },
    },
    signedOut: [],
    signIn: vi.fn(),
    signOut: vi.fn(),
    signOutFailed: [],
    refresh: vi.fn(),
    isRedirecting: false,
    error: null,
  };
  const router = createMemoryRouter(
    [
      { path: "/training/coach", element: <CoachPage /> },
      { path: "/training/coaching", element: <CoachingPage /> },
      { path: "/training/coaching/:memberId", element: <CoachingPage /> },
      { path: "/training/programs", element: <p>programs screen</p> },
    ],
    { initialEntries: [url] },
  );
  render(
    <ZLayerProvider>
      <ToastProvider>
        <AuthContext value={auth}>
          <RouterProvider router={router} />
        </AuthContext>
      </ToastProvider>
    </ZLayerProvider>,
  );
  return router;
}
