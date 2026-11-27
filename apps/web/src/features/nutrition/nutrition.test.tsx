/** The four screens against a faked NutriTrace: what the user sees and what is written */
import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { AuthContext, type AuthValue } from "@/auth/AuthContext";
import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";
import { routes } from "@/router";

import { localDateStr } from "./lib/dates";

const today = localDateStr();
const bread = {
  id: 1,
  user_id: 1,
  name: "Bread",
  brand: "Bakery",
  portion: 100,
  unit: "g",
  nutrition: { calories: 240, proteins: 9 },
  favorite: 0,
  category: null,
  notes: "",
  img_url: null,
  barcode: null,
};
const day = {
  date: today,
  items: [
    {
      uuid: "11111111-1111-1111-1111-111111111111",
      meal: 0,
      addedAt: `${today}T08:00:00.000Z`,
      name: "Oats",
      portion: 80,
      unit: "g",
      quantity: 1,
      nutrition: { calories: 300 },
    },
  ],
  body_stats: {},
  water: [],
  notes: "",
  completed_at: null,
  completed_meals: [],
};

const puts: { path: string; body: unknown }[] = [];

function answer(path: string): unknown {
  // A set-up account: the shell opens no setup assistant and saves nothing.
  if (path === "/settings") {
    return { setupComplete: true, timezone: "Europe/Berlin" };
  }
  if (path === "/foods") return [bread];
  if (path === "/meals") return [];
  if (path === "/app-config/sharing") {
    return { sharing_enabled: false, foods: 0, meals: 0, recipes: 0 };
  }
  if (path === "/diary") return [day];
  if (path.startsWith("/diary/")) return { ...day, date: path.slice(7) };
  return null;
}

const signedIn = {
  state: "signed-in" as const,
  user: { id: 1, username: "tester" },
};

function renderAt(path: string) {
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

describe("nutrition screens", () => {
  beforeEach(async () => {
    puts.length = 0;
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(api.nt, "get").mockImplementation((path) =>
      Promise.resolve(answer(path) as never),
    );
    vi.spyOn(api.nt, "put").mockImplementation((path, body) => {
      puts.push({ path, body });
      return Promise.resolve(
        (path.startsWith("/diary/") ? body : { ok: true }) as never,
      );
    });
    vi.spyOn(api.nt, "post").mockImplementation(() =>
      Promise.resolve({ ok: true } as never),
    );
    await settingsStores.nt.reload();
    await i18n.changeLanguage("en");
  });

  it("serves the day Statistics links to under /nutrition/diary", async () => {
    const router = renderAt("/nutrition/diary?date=2026-01-15");
    await screen.findByRole("region", { name: "Breakfast" });
    expect(router.state.location.pathname).toBe("/nutrition");
    expect(router.state.location.search).toBe("?date=2026-01-15");
  });

  it("shows the day's meals and opens an entry's actions", async () => {
    const user = userEvent.setup();
    renderAt("/nutrition");
    const breakfast = await screen.findByRole("region", { name: "Breakfast" });
    expect(within(breakfast).getByText("Oats")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions for Oats" }));
    for (const name of ["Edit", "Replace", "Move to meal…", "Delete"]) {
      expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
    }
  });

  it("adds quick calories to a meal", async () => {
    const user = userEvent.setup();
    renderAt("/nutrition");
    await user.click(
      await screen.findByRole("button", { name: "Quick calories for Lunch" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: /Energy/ }),
      "250",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(puts.length).toBe(1);
    });
    expect(puts[0].path).toBe(`/diary/${today}`);
    expect(puts[0].body).toMatchObject({
      items: [
        { name: "Oats" },
        { type: "quick_calories", meal: 1, nutrition: { calories: 250 } },
      ],
      deleted_uuids: { items: [], water: [] },
    });
  });

  it("logs a picked food into the meal and goes back", async () => {
    const user = userEvent.setup();
    const router = renderAt(`/nutrition/foods?pick=1&meal=2&date=${today}`);
    await user.click(await screen.findByRole("button", { name: /^Bread/ }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Add" }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/nutrition");
    });
    const write = puts.find((put) => put.path.startsWith("/diary/"));
    expect(write?.body).toMatchObject({
      items: [
        { name: "Oats" },
        { name: "Bread", meal: 2, id: 1, portion: 100, quantity: 1 },
      ],
    });
  });

  it("sets the macro goals of a preset", async () => {
    const user = userEvent.setup();
    renderAt("/nutrition/goals");
    await user.click(
      await screen.findByRole("button", { name: "Balanced 30/40/30" }),
    );

    await waitFor(
      () => {
        expect(puts.some((put) => put.path === "/settings")).toBe(true);
      },
      { timeout: 2000 },
    );
    expect(puts.find((put) => put.path === "/settings")?.body).toMatchObject({
      key: "goals",
      value: {
        proteins: { max: 150 },
        carbohydrates: { max: 200 },
        fat: { max: 67 },
      },
    });
  });
});
