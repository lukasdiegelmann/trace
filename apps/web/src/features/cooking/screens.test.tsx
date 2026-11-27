/**
 * The screens against a fake CookTrace: what the user sees, and which calls
 * their actions make.
 */
import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/api";
import {
  AuthContext,
  type AuthValue,
  type BackendSession,
} from "@/auth/AuthContext";
import { i18n } from "@/i18n";
import { routes } from "@/router";

import {
  cookEntry,
  pantryCategory,
  pantryItem,
  shoppingItem,
} from "./lib/testRows";

const signedIn: BackendSession = {
  state: "signed-in",
  user: { id: 1, username: "test" },
};

const dairy = pantryCategory({
  id: 1,
  name: "Dairy",
  slug: "dairy",
  icon: "local_drink",
  pantry_count: 1,
});
const milk = pantryItem({
  id: 1,
  name: "Milk",
  category: dairy,
  category_id: 1,
  quantity: 2,
  unit: "l",
  serving_size: 100,
  serving_unit: "ml",
  nutrition: { calories: 64, fat: 3.5 },
});
const oats = pantryItem({ id: 2, name: "Oats", in_stock: false, quantity: 0 });

const ANSWERS: Record<string, unknown> = {
  "/settings": {},
  "/pantry": [milk, oats],
  "/pantry/1": milk,
  "/pantry/1/recipes": [{ id: 9, name: "Porridge", img_url: null }],
  "/pantry/categories": [dairy],
  "/units": { disabled: ["oz"], custom: [], usage: { cup: 3 } },
  "/app-config/env-locks": { ai: false, ai_enabled: false },
  "/shopping": [
    shoppingItem({ id: 1, name: "Flour", quantity: 200, aisle: "Baking" }),
    shoppingItem({ id: 2, name: "Eggs", checked: true }),
  ],
  "/cook-diary": [
    cookEntry({
      id: 1,
      date: "2020-01-02",
      recipe_name: "Lentil soup",
      meal_type: "dinner",
    }),
  ],
  "/cook-diary/stats": {
    cooks_this_week: 1,
    cooks_this_month: 1,
    total_cooks: 1,
    top_recipe: null,
    current_streak: 1,
    longest_streak: 4,
  },
  "/cook-diary/heatmap": [],
  "/recipes": [{ id: 9, name: "Porridge", img_url: null }],
  "/recipes/categories": [
    {
      id: 1,
      name: "Soups",
      slug: "soups",
      color: null,
      sort_order: 0,
      recipe_count: 2,
    },
    {
      id: 2,
      name: "Bakes",
      slug: "bakes",
      color: null,
      sort_order: 1,
      recipe_count: 0,
    },
  ],
  "/recipes/tags": [{ name: "vegan", count: 2 }],
  "/recipes/tools": [],
  "/cookbooks": [],
};

function renderAt(path: string) {
  const value: AuthValue = {
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
  // As main.tsx mounts the app: menus need the z-layers.
  render(
    <ZLayerProvider>
      <ToastProvider>
        <AuthContext value={value}>
          <RouterProvider router={router} />
        </AuthContext>
      </ToastProvider>
    </ZLayerProvider>,
  );
  return router;
}

const ok = () => Promise.resolve({ ok: true });

describe("cooking screens", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.spyOn(api.ct, "get").mockImplementation((path) =>
      path in ANSWERS
        ? Promise.resolve(ANSWERS[path] as never)
        : Promise.reject(new ApiError("ct", 404, null)),
    );
    for (const method of ["post", "put", "patch", "delete"] as const) {
      vi.spyOn(api.ct, method).mockImplementation(ok);
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the pantry by category and toggles stock", async () => {
    const user = userEvent.setup();
    renderAt("/cooking/pantry");
    expect(await screen.findByRole("article", { name: "Milk" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Dairy" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Uncategorized" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Mark Oats as in stock" }),
    );
    expect(api.ct.put).toHaveBeenCalledWith("/pantry/2", {
      quantity: 1,
      in_stock: 1,
    });
  });

  it("opens a row's menu and selects several items", async () => {
    const user = userEvent.setup();
    renderAt("/cooking/pantry");
    await screen.findByRole("article", { name: "Milk" });
    await user.click(screen.getByRole("button", { name: "Actions for Milk" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Select multiple" }),
    );
    expect(
      screen.getByRole("heading", { name: "1 selected" }),
    ).toBeInTheDocument();
  });

  it("filters the pantry by the search", async () => {
    const user = userEvent.setup();
    renderAt("/cooking/pantry");
    await screen.findByRole("article", { name: "Milk" });
    await user.type(screen.getByLabelText("Search pantry"), "oat");
    expect(screen.queryByRole("article", { name: "Milk" })).toBeNull();
    expect(screen.getByRole("article", { name: "Oats" })).toBeInTheDocument();
  });

  it("shows an item with nutrition and where it is used, then saves", async () => {
    const user = userEvent.setup();
    renderAt("/cooking/pantry/1");
    expect(
      await screen.findByRole("group", { name: "Nutrition Facts" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Porridge")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name *");
    await user.clear(name);
    await user.type(name, "Whole milk");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(api.ct.put).toHaveBeenCalledWith(
        "/pantry/1",
        expect.objectContaining({
          name: "Whole milk",
          category: "dairy",
          category_id: 1,
          quantity: 2,
          in_stock: 1,
          _base: milk,
        }),
      );
    });
  });

  it("adds a variant despite the server's dedupe by name", async () => {
    const user = userEvent.setup();
    vi.mocked(api.ct.post).mockResolvedValue({ ...milk, id: 7 });
    vi.mocked(api.ct.put).mockResolvedValue({ ...milk, id: 7 });
    renderAt("/cooking/pantry/1");
    await user.click(
      await screen.findByRole("button", { name: "Add variant" }),
    );
    await user.type(screen.getByLabelText("Brand or store"), "Alpha{Enter}");
    await waitFor(() => {
      expect(api.ct.put).toHaveBeenCalledWith("/pantry/7", { name: "Milk" });
    });
    // Created under a name no existing row has.
    expect(api.ct.post).toHaveBeenCalledWith(
      "/pantry",
      expect.objectContaining({
        name: expect.stringMatching(/^Milk \(.{36}\)$/) as string,
        brand: "Alpha",
        generic_parent_id: 1,
      }),
    );
  });

  it("groups the shopping list and checks an item off", async () => {
    const user = userEvent.setup();
    renderAt("/cooking/shopping");
    expect(await screen.findByText("Flour")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Baking" })).toBeInTheDocument();
    expect(screen.getByText("1 remaining · 1 checked")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Check off Flour" }));
    expect(api.ct.patch).toHaveBeenCalledWith("/shopping/1/check", {
      checked: true,
    });
  });

  it("adds to the shopping list", async () => {
    const user = userEvent.setup();
    vi.mocked(api.ct.post).mockResolvedValue(
      shoppingItem({ id: 3, name: "Salt" }),
    );
    renderAt("/cooking/shopping");
    await screen.findByText("Flour");
    await user.type(screen.getByLabelText("Add an item"), "salt{Enter}");
    expect(api.ct.post).toHaveBeenCalledWith("/shopping", {
      name: "salt",
      quantity: null,
    });
  });

  it("takes a typed barcode and opens the known item", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new Error("no camera")),
        enumerateDevices: () => Promise.resolve([]),
      },
    });
    vi.mocked(api.ct.get).mockImplementation((path) =>
      path === "/pantry/by-barcode/400"
        ? Promise.resolve(milk as never)
        : Promise.resolve(ANSWERS[path] as never),
    );
    renderAt("/cooking/pantry");
    await user.click(
      await screen.findByRole("button", { name: "Scan barcode" }),
    );
    expect(
      await screen.findByText(/camera isn't available/),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Barcode number"), "400{Enter}");
    // The known barcode opens its item, ready to edit.
    expect(await screen.findByLabelText("Name *")).toHaveValue("Milk");
  });

  it("plans a cook for a picked recipe", async () => {
    const user = userEvent.setup();
    renderAt("/cooking/diary");
    await screen.findByText("Lentil soup");
    await user.click(screen.getByRole("button", { name: "Plan a cook" }));
    const confirm = screen.getByRole("button", { name: "Plan it" });
    await user.click(await screen.findByRole("button", { name: /Porridge/ }));
    await user.click(screen.getByRole("button", { name: "Snack" }));
    await user.click(confirm);
    await waitFor(() => {
      expect(api.ct.post).toHaveBeenCalledWith("/cook-diary", {
        recipe_id: 9,
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
        meal_type: "snack",
        kind: "planned",
      });
    });
  });

  it("shows the diary with its stats", async () => {
    renderAt("/cooking/diary");
    expect(await screen.findByText("Lentil soup")).toBeInTheDocument();
    expect(await screen.findByText("Longest streak")).toBeInTheDocument();
    expect(api.ct.get).toHaveBeenCalledWith("/cook-diary", {
      query: { from: "1970-01-01", to: expect.any(String) as string },
    });
  });

  it("reorders recipe categories", async () => {
    const user = userEvent.setup();
    renderAt("/cooking/manage");
    await screen.findByText("Soups");
    await user.click(screen.getByRole("button", { name: "Move Bakes up" }));
    expect(api.ct.put).toHaveBeenCalledWith("/recipes/categories/order", {
      ids: [2, 1],
    });
  });

  it("renders every manage section", async () => {
    for (const [section, text] of [
      ["tags", "vegan"],
      ["kitchen-gear", "Nothing yet"],
      ["pantry-categories", "Dairy"],
      ["units", "tablespoon"],
      ["cookbooks", "No cookbooks yet"],
    ]) {
      renderAt(`/cooking/manage/${section}`);
      expect(
        await screen.findByText(new RegExp(text), {}, { timeout: 3000 }),
      ).toBeInTheDocument();
      document.body.innerHTML = "";
    }
  });
});
