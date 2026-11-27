import { describe, expect, it, vi } from "vitest";

import {
  getMealieRecipe,
  mapMealieRecipe,
  mealieSearchPath,
  searchMealie,
  type MealieProxy,
} from "./mealie";

const config = { baseUrl: "https://mealie.test/", token: "t" };

describe("Mealie", () => {
  it("escapes quotes in the query filter", () => {
    const path = mealieSearchPath('12" sub \\');
    const query = new URL(path, "https://x").searchParams.get("queryFilter");
    expect(query).toBe('name LIKE "%12\\" sub \\\\%"');
  });

  it("searches through the proxy and pages", async () => {
    const proxy = vi.fn(() =>
      Promise.resolve({ items: [{ id: "1" }], total: 25 }),
    );
    const page = await searchMealie(
      proxy as unknown as MealieProxy,
      config,
      "soup",
    );
    expect(page).toMatchObject({ totalHits: 25, hasMore: true });
    expect(proxy).toHaveBeenCalledWith(
      "https://mealie.test",
      "t",
      mealieSearchPath("soup"),
    );
  });

  it("calls nothing when not configured", async () => {
    const proxy = vi.fn();
    const empty = { baseUrl: "", token: "" };
    await searchMealie(proxy, empty, "soup");
    expect(
      await getMealieRecipe(proxy as unknown as MealieProxy, empty, "soup"),
    ).toBeNull();
    expect(proxy).not.toHaveBeenCalled();
  });

  it("maps a recipe to one food per serving", () => {
    const food = mapMealieRecipe(
      {
        id: "abc",
        slug: "soup",
        name: "Soup",
        orgURL: "https://www.example.org/soup",
        nutrition: { calories: "250 kcal", sodiumContent: "400" },
      },
      config.baseUrl,
    );
    expect(food).toMatchObject({
      source: "mealie",
      brand: "example.org",
      portion: 100,
      unit: "serving",
      mealieSlug: "soup",
      imgUrl: "https://mealie.test/api/media/recipes/abc/images/original.webp",
    });
    expect(food.nutrition).toMatchObject({ calories: 250, salt: 1, fat: 0 });
  });
});
