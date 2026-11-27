/** Test helper: a training screen with routing, toasts and a signed-in user */
import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { render } from "@testing-library/react";
import {
  createMemoryRouter,
  type RouteObject,
  RouterProvider,
} from "react-router";
import { vi } from "vitest";

import { api } from "@/api";
import { AuthContext, type AuthValue } from "@/auth/AuthContext";

export const TEST_USER = { id: 7, username: "tester", role: "member" };

export function renderScreen(routes: RouteObject[], path: string) {
  const signedIn = { state: "signed-in" as const, user: TEST_USER };
  const auth: AuthValue = {
    sessions: { nt: signedIn, ct: signedIn, lt: signedIn },
    signedOut: [],
    signIn: vi.fn(),
    signOut: vi.fn(),
    signOutFailed: [],
    refresh: vi.fn(),
    isRedirecting: false,
    error: null,
  };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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

/** Answers `api.lt.get` by path; unknown paths answer an empty object */
export function mockLtGet(answers: Record<string, unknown>) {
  return vi.spyOn(api.lt, "get").mockImplementation((path: string) => {
    const answer = path in answers ? answers[path] : {};
    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(answer as never);
  });
}
