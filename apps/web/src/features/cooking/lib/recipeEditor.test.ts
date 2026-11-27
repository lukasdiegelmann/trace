import { describe, expect, it } from "vitest";

import type { Recipe } from "../recipesApi";

import {
  addFromPantry,
  autoTotal,
  DRAFT_MAX_AGE_MS,
  emptyState,
  isSameState,
  moveEntry,
  moveIngredient,
  readDraft,
  removeIngredient,
  removeSection,
  splitSection,
  stateOf,
  toRecipeInput,
  unlinkIngredient,
  updateIngredient,
  type DraftGroup,
} from "./recipeEditor";

const row = (name: string, id = name) => ({
  id,
  qty: "",
  unit: "",
  name,
  note: "",
});
const group = (name: string, ...names: string[]): DraftGroup => ({
  key: name,
  name,
  items: names.map((n) => row(n)),
});
const shape = (groups: DraftGroup[]) =>
  groups.map((g) => [g.name, g.items.map((i) => i.name)]);

describe("sections and rows", () => {
  const groups = [group("", "a", "b"), group("Sauce", "c")];

  it("splits and drops an empty head", () => {
    expect(shape(splitSection(groups, { group: 0, item: 1 }, "New"))).toEqual([
      ["", ["a"]],
      ["New", ["b"]],
      ["Sauce", ["c"]],
    ]);
    expect(
      shape(splitSection(groups, { group: 1, item: 0 }, "New"))[1],
    ).toEqual(["New", ["c"]]);
  });

  it("merges a removed section without losing rows", () => {
    expect(shape(removeSection(groups, 1))).toEqual([["", ["a", "b", "c"]]]);
    expect(shape(removeSection(groups, 0))).toEqual([
      ["Sauce", ["a", "b", "c"]],
    ]);
    expect(shape(removeSection([group("Only", "a")], 0))).toEqual([
      ["", ["a"]],
    ]);
  });

  it("keeps one blank row in the only unnamed section", () => {
    const left = removeIngredient([group("", "a")], { group: 0, item: 0 });
    expect(left[0].items).toHaveLength(1);
    expect(left[0].items[0].name).toBe("");
    expect(
      removeIngredient(groups, { group: 1, item: 0 })[1].items,
    ).toHaveLength(0);
  });

  it("moves within and across sections", () => {
    expect(shape(moveIngredient(groups, { group: 0, item: 1 }, 1))).toEqual([
      ["", ["a"]],
      ["Sauce", ["b", "c"]],
    ]);
    expect(shape(moveIngredient(groups, { group: 1, item: 0 }, -1))).toEqual([
      ["", ["a", "b", "c"]],
      ["Sauce", []],
    ]);
    expect(moveIngredient(groups, { group: 0, item: 0 }, -1)).toBe(groups);
    expect(moveEntry([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveEntry([1], 0, -1)).toEqual([1]);
  });

  it("tidies the quantity when the unit changes, and links pantry rows", () => {
    const start = [
      { key: "k", name: "", items: [{ ...row(""), qty: "0.25" }] },
    ];
    const changed = updateIngredient(
      start,
      { group: 0, item: 0 },
      {
        unit: "cup",
      },
    );
    expect(changed[0].items[0].qty).toBe("1/4");
    const picked = addFromPantry(
      [group("", "")],
      [{ id: 7, name: "Milk", serving_unit: "ml" }],
    );
    expect(picked[0].items).toHaveLength(1);
    expect(picked[0].items[0]).toMatchObject({
      name: "Milk",
      unit: "ml",
      pantry_item_id: 7,
    });
    expect(
      unlinkIngredient(picked, { group: 0, item: 0 })[0].items[0]
        .pantry_item_id,
    ).toBeUndefined();
  });
});

describe("the save", () => {
  it("trims, drops empty things and prunes dead step links", () => {
    const state = emptyState(4);
    state.name = "  Soup ";
    state.prepMinutes = "10";
    state.restMinutes = "5";
    state.ingredientGroups = [
      group("", " leek ", ""),
      group("Empty"),
      group(""),
    ];
    state.steps = [
      {
        key: "1",
        title: "",
        text: " Boil ",
        refIds: [" leek ", "gone"],
        imgUrl: "",
      },
      { key: "2", title: "", text: " ", refIds: [], imgUrl: "" },
    ];
    state.tags = [" a ", ""];
    state.nutrition = { calories: "100", fat: "0", fiber: "" };
    expect(autoTotal(state)).toBe(15);
    const input = toRecipeInput(state, "");
    expect(input).toMatchObject({
      name: "Soup",
      servings: 4,
      prep_minutes: 10,
      cook_minutes: null,
      total_minutes: null,
      tags: ["a"],
      nutrition: { calories: 100 },
      notes: null,
    });
    expect(input.ingredients?.map((g) => [g.name, g.items.length])).toEqual([
      ["", 1],
      ["Empty", 0],
    ]);
    expect(input.steps).toEqual([
      { title: "", text: "Boil", refIds: [" leek "] },
    ]);
  });

  it("round-trips a stored recipe", () => {
    const recipe = {
      name: "A",
      description: null,
      img_url: null,
      rating: 3,
      yield_text: null,
      servings: null,
      prep_minutes: 0,
      cook_minutes: null,
      rest_minutes: null,
      total_minutes: null,
      ingredients: [],
      steps: ["Old string step"],
      tags: [],
      tools: [],
      category_id: null,
      video_url: null,
      source_url: null,
      nutrition: { calories: 5, _derived: { salt: true } },
    } as unknown as Recipe;
    const state = stateOf(recipe, "");
    expect(state.servings).toBe("2");
    expect(state.prepMinutes).toBe("0");
    expect(state.steps[0].text).toBe("Old string step");
    expect(state.ingredientGroups[0].items).toHaveLength(1);
    expect(state.nutrition).toEqual({ calories: "5" });
  });
});

describe("drafts", () => {
  it("expire after two weeks", () => {
    const draft = { v: 1, ts: 1000, state: emptyState(2) };
    expect(readDraft(draft, 1000 + DRAFT_MAX_AGE_MS)).not.toBeNull();
    expect(readDraft(draft, 1001 + DRAFT_MAX_AGE_MS)).toBeNull();
    expect(readDraft(null)).toBeNull();
  });

  it("ignore ids when comparing", () => {
    expect(isSameState(emptyState(2), emptyState(2))).toBe(true);
    expect(isSameState(emptyState(2), emptyState(3))).toBe(false);
  });
});
