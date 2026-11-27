import { describe, expect, it } from "vitest";

import { mealKind } from "./mealKind";

describe("mealKind", () => {
  it("knows German and English slot names", () => {
    expect(mealKind("Breakfast")).toBe("breakfast");
    expect(mealKind("Frühstück")).toBe("breakfast");
    expect(mealKind("Mittagessen")).toBe("lunch");
    expect(mealKind("Evening meal")).toBe("dinner");
    expect(mealKind("Snacks")).toBe("snack");
    expect(mealKind("Protein shake")).toBe("drink");
    expect(mealKind("Meal 5")).toBe("other");
  });
});
