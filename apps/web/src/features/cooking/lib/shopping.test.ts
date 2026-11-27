import { describe, expect, it } from "vitest";

import {
  displayRows,
  groupShopping,
  knownAisles,
  mergeRows,
  moveShoppingRow,
  NO_AISLE,
  planEdit,
  restockPatch,
  restockRows,
} from "./shopping";
import { pantryCategory, pantryItem, shoppingItem } from "./testRows";

const flourA = shoppingItem({
  id: 1,
  name: "Flour",
  unit: "g",
  quantity: 200,
  aisle: "Baking",
  recipe_id: 7,
  recipe_name: "Bread",
});
const flourB = shoppingItem({
  id: 2,
  name: "flour ",
  unit: "G",
  quantity: 100.5,
  aisle: "Baking",
  recipe_id: 8,
  recipe_name: "Cake",
});
const eggs = shoppingItem({ id: 3, name: "Eggs", checked: true });
const items = [flourA, flourB, eggs];

describe("shopping merge and groups", () => {
  it("merges same name, unit and checked state", () => {
    const [merged] = mergeRows([flourA, flourB]);
    expect(merged.quantity).toBe(300.5);
    expect(merged.recipeNames).toEqual(["Bread", "Cake"]);
    expect(merged.members).toHaveLength(2);
    expect(
      mergeRows([flourA, { ...flourB, quantity: null }])[0].quantity,
    ).toBeNull();
    expect(mergeRows([flourA, { ...flourB, checked: true }])).toHaveLength(2);
    expect(
      mergeRows([flourA, { ...flourB, aisle: "Other" }], true),
    ).toHaveLength(2);
  });

  it("groups by aisle with the unnamed one last", () => {
    expect(
      groupShopping(items, "aisle").map((group) => [
        group.key,
        group.rows.length,
      ]),
    ).toEqual([
      ["Baking", 1],
      [NO_AISLE, 1],
    ]);
  });

  it("groups by recipe without merging, and flat", () => {
    expect(groupShopping(items, "recipe").map((group) => group.title)).toEqual([
      "Bread",
      "Cake",
      null,
    ]);
    expect(groupShopping(items, "flat")[0]?.rows).toHaveLength(2);
    expect(displayRows(items, "recipe")).toHaveLength(3);
    expect(displayRows(items, "flat")).toHaveLength(2);
  });

  it("collects the known aisles", () => {
    expect(
      knownAisles(
        [
          pantryCategory({
            id: 1,
            name: "Spices",
            slug: "spice",
            default_aisle: "baking",
          }),
          pantryCategory({ id: 2, name: "Dairy", slug: "dairy" }),
        ],
        items,
      ),
    ).toEqual(["baking", "Dairy"]);
  });

  it("moves a row within its group, members included", () => {
    const rows = [
      shoppingItem({ id: 4, name: "A", aisle: "X", sort_order: 0 }),
      shoppingItem({ id: 5, name: "B", aisle: "X", sort_order: 1 }),
    ];
    const [group] = groupShopping(rows, "aisle");
    expect(moveShoppingRow(group, 0, 1, "aisle")).toEqual([
      { id: 5, sort_order: 0, aisle: "X" },
      { id: 4, sort_order: 1, aisle: "X" },
    ]);
    expect(moveShoppingRow(group, 0, -1, "aisle")).toBeNull();
  });
});

describe("editing a row", () => {
  const [merged] = mergeRows([flourA, flourB]);

  it("updates a single row with its base", () => {
    expect(planEdit(flourA, { name: "Rye", quantity: "", unit: "" })).toEqual({
      updates: [
        {
          id: 1,
          patch: { name: "Rye", quantity: null, unit: null, _base: flourA },
        },
      ],
      removes: [],
    });
  });

  it("folds merged rows when the total changes", () => {
    const plan = planEdit(merged, {
      name: "Flour",
      quantity: "500",
      unit: "g",
    });
    expect(plan.removes).toEqual([2]);
    expect(plan.updates[0]?.patch.quantity).toBe(500);
  });

  it("renames every member when the total stays", () => {
    const plan = planEdit(merged, {
      name: "Rye",
      quantity: "300.5",
      unit: "g",
    });
    expect(plan.removes).toEqual([]);
    expect(plan.updates).toEqual([
      { id: 1, patch: { name: "Rye", unit: "g" } },
      { id: 2, patch: { name: "Rye", unit: "g" } },
    ]);
  });
});

describe("restock", () => {
  const pantry = [
    pantryItem({
      id: 10,
      name: "Milk",
      in_stock: false,
      nutrition_source_variant_id: 12,
    }),
    pantryItem({
      id: 11,
      name: "Milk",
      brand: "A",
      generic_parent_id: 10,
      in_stock: false,
    }),
    pantryItem({
      id: 12,
      name: "Milk",
      brand: "B",
      generic_parent_id: 10,
      in_stock: false,
    }),
    pantryItem({ id: 20, name: "Eggs", in_stock: false, quantity: 0 }),
    pantryItem({ id: 30, name: "Salt", in_stock: true }),
    pantryItem({ id: 40, name: "Twin", in_stock: false }),
    pantryItem({ id: 41, name: "Twin", in_stock: false }),
  ];
  const bought = [
    shoppingItem({ id: 1, name: "x", pantry_id: 10, checked: true }),
    shoppingItem({ id: 2, name: "eggs", checked: true }),
    shoppingItem({ id: 3, name: "Salt", checked: true }),
    shoppingItem({ id: 4, name: "Twin", checked: true }),
    shoppingItem({ id: 5, name: "Eggs", checked: false }),
  ];

  it("offers only certain, out-of-stock matches", () => {
    expect(restockRows(bought, pantry)).toEqual([
      {
        key: "g10",
        label: "Milk",
        options: [
          { id: 11, name: "A" },
          { id: 12, name: "B" },
        ],
        selectedId: 12,
      },
      { key: "p20", label: "Eggs", options: null, selectedId: 20 },
    ]);
  });

  it("gives a zero quantity a 1 and can undo it", () => {
    const eggRow = pantry[3];
    expect(restockPatch(eggRow)).toEqual({
      patch: { in_stock: 1, quantity: 1 },
      undo: { in_stock: 0, quantity: 0 },
    });
  });
});
