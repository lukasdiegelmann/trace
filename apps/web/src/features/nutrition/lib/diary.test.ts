import { describe, expect, it } from "vitest";

import type { DiaryDay, DiaryItem } from "../api";
import {
  appendItems,
  clearMealItems,
  contributors,
  copiesOfItems,
  mealShare,
  moveMealItems,
  portionChanges,
  timeOfDay,
  withTimeOfDay,
  newDiaryItem,
  normalizeDay,
  quickCaloriesItem,
  removeSplitChild,
  removeWater,
  setNote,
  splitIngredients,
  toDiaryWrite,
  updateItem,
} from "./diary";

const NOW = new Date("2026-09-06T10:00:00Z");

function item(uuid: string, extra: Partial<DiaryItem> = {}): DiaryItem {
  return {
    uuid,
    meal: 0,
    addedAt: "2026-09-06T08:00:00.000Z",
    name: uuid,
    nutrition: { calories: 100 },
    quantity: 1,
    ...extra,
  };
}

function day(items: DiaryItem[] = []): DiaryDay {
  return normalizeDay({ items }, "2026-09-06");
}

describe("write payload", () => {
  it("keeps only the stored fields and strips image data", () => {
    const heavy = {
      ...item("a", { imgUrl: "/nt/uploads/x.jpg" }),
      items: [{ name: "flour" }],
      alt_units: [],
      favorite: 1,
      _splitItems: [
        { ...item("c", { imgUrl: "data:image/png;base64,xx" }), extra: 1 },
      ],
    } as unknown as DiaryItem;
    const write = toDiaryWrite(day([heavy]), { items: ["gone"] });
    expect(write.items[0]).not.toHaveProperty("items");
    expect(write.items[0]).not.toHaveProperty("favorite");
    expect(write.items[0].imgUrl).toBe("/uploads/x.jpg");
    expect(write.items[0]._splitItems?.[0].imgUrl).toBe("");
    expect(write.items[0]._splitItems?.[0]).not.toHaveProperty("extra");
    expect(write.deleted_uuids).toEqual({ items: ["gone"], water: [] });
  });
});

describe("item changes", () => {
  it("gives a new item its own identity and remembers the food", () => {
    const added = newDiaryItem({ id: 7, name: "Bread", nutrition: {} }, 2, NOW);
    expect(added.meal).toBe(2);
    expect(added.addedAt).toBe(NOW.toISOString());
    expect(added.food_server_id).toBe(7);
    expect(added.uuid).toMatch(/[0-9a-f-]{20,}/);
  });

  it("marks an edit with updatedAt so the server merge keeps it", () => {
    const change = updateItem("a", { meal: 1 }, NOW)(day([item("a")]));
    expect(change?.day.items[0]).toMatchObject({
      meal: 1,
      updatedAt: NOW.toISOString(),
    });
    expect(updateItem("zz", {}, NOW)(day())).toBeNull();
  });

  it("moves and clears a meal, naming what it removes", () => {
    const start = day([item("a"), item("b", { meal: 1 })]);
    expect(moveMealItems(0, 1)(start)?.day.items.map((i) => i.meal)).toEqual([
      1, 1,
    ]);
    expect(moveMealItems(0, 0)(start)).toBeNull();
    expect(moveMealItems(3, 0)(start)).toBeNull();
    expect(clearMealItems(1)(start)?.deleted).toEqual({ items: ["b"] });
    expect(clearMealItems(5)(start)).toBeNull();
    expect(appendItems([])(start)).toBeNull();
  });

  it("copies with new uuids and the same food", () => {
    const [copy] = copiesOfItems([item("a", { id: 3 })], 2, NOW);
    expect(copy.uuid).not.toBe("a");
    expect(copy).toMatchObject({ id: 3, meal: 2, name: "a" });
  });

  it("names removed water and skips an unchanged note", () => {
    expect(removeWater("w")(day())?.deleted).toEqual({ water: ["w"] });
    expect(setNote("  ")(day())).toBeNull();
    expect(setNote("slept well\n\n")(day())?.day.notes).toBe("slept well");
  });
});

describe("quick calories", () => {
  it("keeps only positive macros, rounded", () => {
    const added = quickCaloriesItem(
      { kcal: 200.4, proteins: 12.34, carbohydrates: 0, name: " " },
      1,
      NOW,
    );
    expect(added.type).toBe("quick_calories");
    expect(added.name).toBe("Quick Calories");
    expect(added.nutrition).toEqual({ calories: 200, proteins: 12.3 });
  });

  it("refuses zero calories", () => {
    expect(() => quickCaloriesItem({ kcal: 0 }, 0)).toThrow();
  });
});

describe("split recipes", () => {
  const ingredients = [
    {
      name: "pasta",
      portion: 300,
      unit: "g",
      quantity: 1,
      nutrition: { calories: 450 },
    },
    {
      name: "saffron",
      portion: 1,
      unit: "g",
      quantity: 1,
      nutrition: { calories: 3 },
    },
  ];

  it("scales by the ingredients' own mass, not the recipe portion", () => {
    const logged = item("r", { portion: 150.5, quantity: 1 });
    const children = splitIngredients(
      logged,
      ingredients,
      { portion: 99 },
      NOW,
    );
    expect(children[0].portion).toBe(150);
    expect(children[0].nutrition.calories).toBeCloseTo(225);
    expect(children[1].portion).toBe(0.5);
    expect(children.every((child) => child.quantity === 1)).toBe(true);
  });

  it("removes the parent with its last ingredient", () => {
    const parent = item("r", { _splitItems: [item("c")] });
    const change = removeSplitChild("r", 0)(day([parent]));
    expect(change?.day.items).toEqual([]);
    expect(change?.deleted).toEqual({ items: ["r"] });
  });
});

describe("totals", () => {
  const items = [
    item("a", {
      quantity: 2,
      nutrition: { calories: 100, proteins: 10, carbohydrates: 10, fat: 2.2 },
    }),
    item("b", { nutrition: { calories: 0 } }),
  ];

  it("shares a meal's calories", () => {
    expect(mealShare(items)).toEqual({
      kcal: 200,
      protein: 40,
      carbs: 40,
      fat: 20,
    });
    expect(mealShare([item("z", { nutrition: {} })])).toBeNull();
  });

  it("lists contributors largest first without zeros", () => {
    expect(contributors(items, "calories").map((c) => c.value)).toEqual([200]);
  });
});

describe("editing an entry", () => {
  it("scales the nutrition with the portion, across units", () => {
    const logged = item("a", {
      portion: 1,
      unit: "slice",
      alt_units: [{ abbr: "slice", grams: 50 }],
      nutrition: { calories: 120 },
    });
    expect(
      portionChanges(logged, { portion: 100, unit: "g", quantity: 2 }),
    ).toEqual({
      portion: 100,
      unit: "g",
      quantity: 2,
      nutrition: { calories: 240 },
    });
  });

  it("moves the logged time within the same day", () => {
    const iso = new Date(2026, 8, 6, 8, 5).toISOString();
    expect(timeOfDay(iso)).toBe("08:05");
    expect(withTimeOfDay(iso, "19:30")).toBe(
      new Date(2026, 8, 6, 19, 30).toISOString(),
    );
    expect(withTimeOfDay(iso, "")).toBe(iso);
    expect(timeOfDay(undefined)).toBe("");
  });
});
