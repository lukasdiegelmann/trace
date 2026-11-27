/** Render tests of the recipe screens (#5), through the app's own routes */
import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/api";
import { AuthContext, type AuthValue } from "@/auth/AuthContext";
import { i18n } from "@/i18n";
import { routes } from "@/router";

const recipe = {
  id: 1,
  user_id: 1,
  name: "Pancakes",
  description: "Thin ones",
  img_url: null,
  servings: 4,
  yield_text: null,
  prep_minutes: 10,
  cook_minutes: 15,
  rest_minutes: null,
  total_minutes: null,
  rating: 4,
  favorite: true,
  ingredients: [{ name: "", items: [{ id: "a", qty: "2", name: "eggs" }] }],
  steps: [{ title: "Fry", text: "Fry for 2 min." }],
  tags: [],
  tools: [],
  nutrition: {},
  source_url: null,
  video_url: null,
  // A comment or note that would run script if it were set as HTML
  notes: '<x><img src="y" onerror="alert(1)"></x><b>Hot pan</b>',
  category_id: null,
  category: null,
  created_at: "2026-01-01 10:00:00",
  updated_at: "2026-01-01 10:00:00",
  last_cooked_at: null,
  cook_count: 0,
  can_edit: true,
};

const ANSWERS: Record<string, unknown> = {
  "/recipes": [recipe],
  "/recipes/1": recipe,
  "/recipes/shared-with-me": [],
  "/recipes/categories": [],
  "/recipes/1/cooks": [],
  "/recipes/1/comments": [],
  "/recipes/1/versions": [],
  "/cookbooks": [],
  "/cookbooks/shared-with-me": [],
  "/cookbooks/2": {
    id: 2,
    name: "Sunday",
    description: null,
    cover_image_url: null,
    is_smart: false,
    smart_filter: null,
    recipe_count: 2,
    can_edit: true,
    recipes: [recipe, { id: 9, name: "Secret", locked: true }],
  },
  "/pantry": [],
  "/settings": {},
};

const signedIn = {
  state: "signed-in" as const,
  user: { id: 1, username: "u" },
};
const signedOut = { state: "signed-out" as const, isExpired: false };

function renderAt(path: string, isSignedIn = true) {
  const session = isSignedIn ? signedIn : signedOut;
  const value: AuthValue = {
    sessions: { nt: session, ct: session, lt: session },
    signedOut: isSignedIn ? [] : ["nt", "ct", "lt"],
    signIn: vi.fn(),
    signOut: vi.fn(),
    signOutFailed: [],
    refresh: vi.fn(),
    isRedirecting: false,
    error: null,
  };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ZLayerProvider>
      <ToastProvider>
        <AuthContext value={value}>
          <RouterProvider router={router} />
        </AuthContext>
      </ToastProvider>
    </ZLayerProvider>,
  );
}

describe("recipe screens", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.spyOn(api.ct, "get").mockImplementation((path) =>
      path in ANSWERS
        ? Promise.resolve(ANSWERS[path] as never)
        : Promise.reject(new ApiError("ct", 404, null)),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("lists the recipes with their facts", async () => {
    renderAt("/cooking");
    expect(
      await screen.findByRole("heading", { name: "Pancakes" }),
    ).toBeTruthy();
    expect(screen.getByText("25m")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a recipe" })).toBeTruthy();
  });

  it("shows a recipe, its notes without the script in them", async () => {
    const { container } = renderAt("/cooking/recipes/1");
    expect(await screen.findByText("Hot pan")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Start 2:00 timer/ }),
    ).toBeTruthy();
    expect(container.querySelector("img[onerror], img[src='y']")).toBeNull();
  });

  it("offers a guest no rating, favourite or cook log", async () => {
    vi.spyOn(api.ct, "get").mockImplementation((path) =>
      Promise.resolve(
        (path === "/recipes/1"
          ? { ...recipe, user_id: 2, can_edit: false }
          : ANSWERS[path]) as never,
      ),
    );
    renderAt("/cooking/recipes/1");
    expect(await screen.findByText("Hot pan")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Rated 4 of 5" })).toBeTruthy();
    for (const name of ["Edit", "Delete", "Remove from favorites"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryByRole("button", { name: "I cooked this" })).toBeNull();
  });

  it("shows a cookbook's locked recipe by name only", async () => {
    renderAt("/cooking/cookbooks/2");
    expect(await screen.findByText("Secret")).toBeTruthy();
    expect(screen.getByText(/Not shared with you/)).toBeTruthy();
  });

  it("opens a shared recipe without a sign-in", async () => {
    const doFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(recipe), { status: 200 }));
    vi.stubGlobal("fetch", doFetch);
    renderAt("/r/token-12345678", false);
    expect(
      await screen.findByRole("heading", { name: "Pancakes" }),
    ).toBeTruthy();
    expect(doFetch).toHaveBeenCalledWith(
      "/ct/api/r/token-12345678",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("says when a shared link no longer works", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("{}", { status: 404 })),
    );
    renderAt("/r/token-12345678", false);
    expect(
      await screen.findByText("This share link no longer works."),
    ).toBeTruthy();
  });
});
