import { afterEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/api";
import { settingsStores } from "@/features/shared/settings";

import { COOKING_DATA_CHANGED } from "../common/dataChanged";

import { COOKING_TOOL_SPECS } from "./catalog";
import { cookingToolset } from "./index";
import { cookingTools } from "./tools";

function run(name: string, args: Record<string, unknown> = {}) {
  const tool = cookingTools().find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(args);
}

function onGet(answers: Record<string, unknown>) {
  return vi.spyOn(api.ct, "get").mockImplementation((path: string) => {
    if (!(path in answers)) {
      return Promise.reject(new Error(`unexpected GET ${path}`));
    }
    return Promise.resolve(answers[path] as never);
  });
}

function countChanges() {
  const listener = vi.fn();
  window.addEventListener(COOKING_DATA_CHANGED, listener);
  return listener;
}

const recipe = (values: Record<string, unknown>) => ({
  id: 1,
  name: "Lasagne",
  description: null,
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 30,
  rest_minutes: null,
  total_minutes: null,
  rating: null,
  favorite: false,
  last_cooked_at: null,
  cook_count: 0,
  category: null,
  tags: [],
  ...values,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the catalog", () => {
  it("has the old tools, get_diary renamed", () => {
    expect(cookingTools().map((tool) => tool.name)).toEqual([
      "get_recipes",
      "list_recipe_categories",
      "get_recipe",
      "get_pantry",
      "list_pantry_categories",
      "find_recipes_from_pantry",
      "get_cook_diary",
      "get_shopping_list",
      "get_cookbooks",
      "get_cookbook",
      "log_cook",
      "plan_cook",
      "add_to_shopping",
      "add_to_pantry",
      "set_pantry_density",
      "set_pantry_stock",
      "add_to_cookbook",
      "import_recipe_from_url",
      "create_recipe",
    ]);
    expect(COOKING_TOOL_SPECS).toHaveLength(cookingTools().length);
  });
});

describe("read tools", () => {
  it("filters recipes by text without accents, category and favourite", async () => {
    onGet({
      "/recipes": [
        recipe({ id: 1, tags: ["Orégano"], favorite: true }),
        recipe({ id: 2, name: "Oregano bread" }),
        recipe({
          id: 3,
          name: "Cake",
          category: { name: "Desserts", slug: "desserts" },
        }),
      ],
    });
    expect(await run("get_recipes", { query: "oregano" })).toMatchObject([
      { id: 1, total_minutes: 40, category: null },
      { id: 2 },
    ]);
    expect(
      await run("get_recipes", { query: "oregano", favorite: true }),
    ).toMatchObject([{ id: 1 }]);
    expect(await run("get_recipes", { category: "DESSERTS" })).toMatchObject([
      { id: 3, category: "Desserts" },
    ]);
  });

  it("ranks recipes by what the pantry covers", async () => {
    onGet({
      "/recipes": [
        recipe({ id: 1, pantry_match: { have: 3, need: 4 } }),
        recipe({ id: 2, pantry_match: { have: 2, need: 2 } }),
        recipe({ id: 3, pantry_match: { have: 1, need: 4 } }),
        recipe({ id: 4 }),
      ],
    });
    expect(await run("find_recipes_from_pantry")).toMatchObject([
      { id: 2, ratio: 1 },
      { id: 1, ratio: 0.75 },
    ]);
  });

  it("nests variants and counts a generic with a stocked one", async () => {
    const row = (values: Record<string, unknown>) => ({
      name: "Milk",
      brand: null,
      in_stock: 0,
      expires_on: null,
      generic_parent_id: null,
      category: { name: "Dairy & Eggs", slug: "dairy" },
      nutrition: null,
      ...values,
    });
    onGet({
      "/pantry": [
        row({ id: 1 }),
        row({
          id: 2,
          brand: "A",
          in_stock: 1,
          generic_parent_id: 1,
          expires_on: "2026-12-05",
        }),
        row({
          id: 3,
          brand: "B",
          generic_parent_id: 1,
          expires_on: "2026-12-01",
        }),
        row({ id: 4, name: "Flour", category: null }),
      ],
    });
    expect(await run("get_pantry", { in_stock_only: true })).toMatchObject([
      {
        id: 1,
        in_stock: true,
        expires_on: "2026-12-01",
        category: "Dairy & Eggs",
        has_nutrition: false,
        variants: [{ id: 2 }, { id: 3 }],
      },
    ]);
    expect(await run("get_pantry", { query: "flo" })).toMatchObject([
      { id: 4, in_stock: false },
    ]);
  });

  it("reads the cook diary and asks for both dates", async () => {
    const get = onGet({
      "/cook-diary": [
        { id: 1, date: "2026-11-01", photos: '["/a.jpg"]', rating: null },
      ],
    });
    expect(await run("get_cook_diary", { from: "2026-11-01" })).toEqual({
      error: "from and to are required (YYYY-MM-DD)",
    });
    expect(get).not.toHaveBeenCalled();
    expect(
      await run("get_cook_diary", { from: "2026-11-01", to: "2026-11-30" }),
    ).toMatchObject([{ id: 1, has_photo: true, meal_type: null }]);
    expect(get).toHaveBeenCalledWith("/cook-diary", {
      query: { from: "2026-11-01", to: "2026-11-30" },
    });
  });

  it("answers a failure as { error }", async () => {
    vi.spyOn(api.ct, "get").mockRejectedValue(
      new ApiError("ct", 404, { error: "Not found" }),
    );
    expect(await run("get_recipe", { id: 9 })).toHaveProperty("error");
  });
});

describe("write tools", () => {
  it("logs a cook with only what was said, and tells open screens", async () => {
    const post = vi
      .spyOn(api.ct, "post")
      .mockResolvedValue(recipe({ cook_count: 2 }));
    const changes = countChanges();
    expect(
      await run("log_cook", { recipe_id: "1", meal_type: "dinner" }),
    ).toMatchObject({ ok: true, recipe: { id: 1, cook_count: 2 } });
    expect(post).toHaveBeenCalledWith("/recipes/1/cooked", {
      meal_type: "dinner",
    });
    expect(changes).toHaveBeenCalledOnce();
  });

  it("plans a cook", async () => {
    const post = vi.spyOn(api.ct, "post").mockResolvedValue({ id: 5 });
    expect(await run("plan_cook", { recipe_id: 1 })).toEqual({
      error: "recipe_id and date required",
    });
    expect(
      await run("plan_cook", { recipe_id: 1, date: "2026-12-04" }),
    ).toEqual({ ok: true, entry: { id: 5 } });
    expect(post).toHaveBeenCalledWith("/cook-diary", {
      recipe_id: 1,
      date: "2026-12-04",
      notes: null,
      meal_type: null,
      kind: "planned",
    });
  });

  it("adds each named shopping item", async () => {
    const post = vi
      .spyOn(api.ct, "post")
      .mockResolvedValueOnce({ id: 1, name: "Tomato" })
      .mockRejectedValueOnce(new Error("Server down"));
    const changes = countChanges();
    expect(await run("add_to_shopping", { items: [] })).toEqual({
      error: "items array required",
    });
    expect(
      await run("add_to_shopping", {
        items: [{ name: " Tomato ", quantity: 2 }, {}, { name: "Onion" }],
      }),
    ).toEqual({ error: "Server down" });
    expect(post).toHaveBeenNthCalledWith(1, "/shopping", {
      name: "Tomato",
      quantity: 2,
      unit: null,
      aisle: null,
    });
    // The first one was saved all the same.
    expect(changes).toHaveBeenCalledOnce();
  });

  it("guards the density's range and clears it with 0", async () => {
    const put = vi
      .spyOn(api.ct, "put")
      .mockResolvedValue({ id: 3, name: "Flour" });
    expect(
      await run("set_pantry_density", { pantry_id: 3, g_per_cup: 6000 }),
    ).toEqual({ error: "g_per_cup must be between 0 and 5000" });
    expect(put).not.toHaveBeenCalled();
    expect(
      await run("set_pantry_density", { pantry_id: 3, g_per_cup: 0 }),
    ).toEqual({
      ok: true,
      pantry_item: { id: 3, name: "Flour", g_per_cup: null },
    });
    expect(put).toHaveBeenCalledWith("/pantry/3", { g_per_cup: null });
  });

  it("sets the stock", async () => {
    const patch = vi
      .spyOn(api.ct, "patch")
      .mockResolvedValue({ ok: true, in_stock: false });
    expect(
      await run("set_pantry_stock", { pantry_id: 7, in_stock: false }),
    ).toEqual({ ok: true, pantry_item: { id: 7, in_stock: false } });
    expect(patch).toHaveBeenCalledWith("/pantry/7/stock", { in_stock: false });
  });

  it("adds to the pantry and to a cookbook", async () => {
    const post = vi
      .spyOn(api.ct, "post")
      .mockResolvedValueOnce({ id: 2, name: "Oil", in_stock: 1 })
      .mockResolvedValueOnce({ added: 2 });
    expect(await run("add_to_pantry", { name: "Oil" })).toEqual({
      ok: true,
      pantry_item: { id: 2, name: "Oil", in_stock: true },
    });
    expect(
      await run("add_to_cookbook", { cookbook_id: 4, recipe_ids: [1, "2"] }),
    ).toEqual({ ok: true, added: 2 });
    expect(post).toHaveBeenLastCalledWith("/cookbooks/4/recipes", {
      recipe_ids: [1, 2],
    });
  });

  it("imports a link with the old defaults and names a duplicate", async () => {
    const post = vi
      .spyOn(api.ct, "post")
      .mockResolvedValueOnce({
        id: 8,
        name: "Chili",
        source_url: "https://example.com/chili",
      })
      .mockResolvedValueOnce({ skipped: true, existing_id: 8 });
    const url = "https://example.com/chili";
    expect(await run("import_recipe_from_url", { url })).toEqual({
      ok: true,
      recipe: { id: 8, name: "Chili", source_url: url },
    });
    expect(post).toHaveBeenCalledWith("/recipes/scrape", {
      url,
      addToPantry: true,
      applyTags: false,
      importCategories: true,
    });
    expect(await run("import_recipe_from_url", { url })).toEqual({
      ok: true,
      skipped: true,
      existing_id: 8,
    });
  });

  it("creates a recipe only with ingredients and steps", async () => {
    const post = vi
      .spyOn(api.ct, "post")
      .mockResolvedValue({ id: 9, name: "Soup" });
    expect(await run("create_recipe", { name: "Soup" })).toEqual({
      error: "ingredients required",
    });
    expect(
      await run("create_recipe", {
        name: "Soup",
        ingredients: [{ name: "", items: [{ name: "Water" }] }],
        steps: [{ text: "Boil." }],
      }),
    ).toEqual({ ok: true, recipe: { id: 9, name: "Soup" } });
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      servings: null,
      tags: [],
      tools: [],
    });
  });
});

describe("the toolset", () => {
  it("tells the model the user's units and date format", async () => {
    vi.spyOn(settingsStores.ct, "ensureLoaded").mockResolvedValue();
    vi.spyOn(settingsStores.ct, "getSnapshot").mockReturnValue({
      ...settingsStores.ct.getSnapshot(),
      values: {
        ...settingsStores.ct.getSnapshot().values,
        measurementSystem: "metric",
        energyUnit: "kJ",
        dateFormat: "EU",
      },
    });
    const context = await cookingToolset.context();
    expect(context).toContain("metric (g, ml, °C)");
    expect(context).toContain("kilojoules (kJ)");
    expect(context).toContain("date format is EU");
  });

  it("offers the four chips, translated", () => {
    expect(cookingToolset.suggestions()).toHaveLength(4);
    expect(
      cookingToolset
        .suggestions()
        .every((chip) => !chip.includes("assistant.")),
    ).toBe(true);
  });
});
