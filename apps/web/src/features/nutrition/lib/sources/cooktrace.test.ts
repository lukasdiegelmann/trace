import { describe, expect, it, vi } from "vitest";

import {
  checkCooktraceUpdate,
  isCooktraceNewer,
  mapCooktraceRecipe,
  searchCooktracePantry,
  searchCooktraceRecipes,
  type CooktraceProxy,
} from "./cooktrace";

const config = { baseUrl: "https://ct.test/", token: "t" };
const asProxy = (mock: unknown) => mock as CooktraceProxy;

describe("mapCooktraceRecipe", () => {
  it("turns per-serving nutrition into totals and keeps empty units", () => {
    const prefill = mapCooktraceRecipe({
      id: 169,
      name: "Soup",
      servings: 4,
      portion: 250,
      unit: "g",
      nutrition: { calories: 100, sodium: 400 },
      source_url: "https://ct.test/r/169",
      items: [
        { name: "Egg yolk", portion: 4, unit: "", img_url: "https://i" },
        { name: "Salt", nutrition: { salt: 1 } },
      ],
    });
    expect(prefill).toMatchObject({
      servings: 4,
      portion: 250,
      source_app: "cooktrace",
      source_external_id: "recipe:169",
    });
    expect(prefill.nutrition).toEqual({
      calories: 400,
      sodium: 1600,
      salt: 4,
    });
    expect(prefill.items[0]).toMatchObject({
      portion: 4,
      unit: "",
      quantity: 1,
      imgUrl: "https://i",
    });
    expect(prefill.items[1].nutrition).toEqual({
      salt: 1,
      sodium: 400,
      _derived: { sodium: true },
    });
  });
});

describe("search", () => {
  it("pages recipes by offset", async () => {
    const proxy = vi.fn(() => Promise.resolve({ items: [{}], total: 30 }));
    const page = await searchCooktraceRecipes(asProxy(proxy), config, "a&b", 2);
    expect(page.hasMore).toBe(true);
    expect(proxy).toHaveBeenCalledWith(
      "https://ct.test",
      "t",
      "/api/v1/recipes?q=a%26b&limit=25&offset=25",
      "GET",
    );
  });

  it("maps pantry rows to picks", async () => {
    const proxy = vi.fn(() =>
      Promise.resolve({
        items: [
          {
            name: "Flour",
            img_url: "https://i",
            source_app: "cooktrace",
            source_external_id: "pantry:1",
          },
        ],
      }),
    );
    const page = await searchCooktracePantry(asProxy(proxy), config, "flour");
    expect(page.items[0]).toMatchObject({
      source: "cooktracePantry",
      imgUrl: "https://i",
      source_external_id: "pantry:1",
    });
  });
});

describe("checkCooktraceUpdate", () => {
  const meal = {
    id: 1,
    updated_at: "2026-01-02 10:00:00",
    source_app: "cooktrace",
    source_external_id: "recipe:7",
  };
  const answering = (updated: string) =>
    asProxy(() => Promise.resolve({ id: 7, updated_at: updated }));

  it("compares SQLite UTC and ISO times", () => {
    expect(
      isCooktraceNewer("2026-01-02T10:00:01Z", "2026-01-02 10:00:00"),
    ).toBe(true);
  });

  it("reports newer, same, deleted and unknown", async () => {
    const status = async (proxy: CooktraceProxy) =>
      (await checkCooktraceUpdate(proxy, config, meal)).status;
    expect(await status(answering("2026-01-03 00:00:00"))).toBe("updated");
    expect(await status(answering("2026-01-02 10:00:00"))).toBe("upToDate");
    const failing = (code: number) =>
      asProxy(() =>
        Promise.reject(Object.assign(new Error("x"), { status: code })),
      );
    expect(await status(failing(404))).toBe("deleted");
    expect(await status(failing(503))).toBe("unknown");
  });

  it("skips fresh imports and other meals", async () => {
    const proxy = vi.fn();
    for (const other of [
      { ...meal, id: null },
      { ...meal, updated_at: null },
      { ...meal, source_app: "mealie" },
      { ...meal, source_external_id: "pantry:1" },
    ]) {
      expect(await checkCooktraceUpdate(asProxy(proxy), config, other)).toEqual(
        { status: "notApplicable" },
      );
    }
    expect(proxy).not.toHaveBeenCalled();
  });
});
