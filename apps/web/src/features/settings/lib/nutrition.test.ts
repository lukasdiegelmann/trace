import { describe, expect, it } from "vitest";

import { addCustomUnit } from "./customUnits";
import { addCategory, categoryDisplay } from "./foodCategories";
import { moveItem, orderedIds, toggleItem } from "./lists";
import { mealTimesFor } from "./mealTimes";
import {
  addCustomNutriment,
  orderedNutrimentIds,
  visibleNutrimentIds,
} from "./nutrientSettings";
import { parseNumberInput } from "./numbers";
import { fromMl, newContainer, toMl } from "./water";

describe("lists", () => {
  it("moves, orders and toggles", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a"], 0, 5)).toEqual(["a"]);
    expect(orderedIds(["a", "b", "c"], ["c", "x", "c"])).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(toggleItem(["a", "b"], "a", true)).toEqual(["b", "a"]);
    expect(toggleItem(["a", "b"], "a", false)).toEqual(["b"]);
  });
});

describe("parseNumberInput", () => {
  it("takes decimal commas and clamps", () => {
    expect(parseNumberInput("2,5")).toBe(2.5);
    expect(parseNumberInput("40", { min: 1, max: 20 })).toBe(20);
    expect(parseNumberInput("", { fallback: 2 })).toBe(2);
    expect(parseNumberInput("x")).toBeNull();
    expect(parseNumberInput("3.9", { isInteger: true })).toBe(3);
  });
});

describe("water", () => {
  it("converts like the old UI", () => {
    expect(toMl(12, "oz")).toBe(355);
    expect(fromMl(355, "oz")).toBe(12);
    expect(fromMl(500, "L")).toBe(0.5);
    expect(fromMl(3785, "G")).toBe(1);
  });

  it("needs a name and a positive volume", () => {
    expect(newContainer(" ", 1, "L", 1)).toBeNull();
    expect(newContainer("Bottle", 0, "L", 1)).toBeNull();
    expect(newContainer("Bottle", 0.75, "L", 7)).toEqual({
      id: "7",
      name: "Bottle",
      volumeMl: 750,
    });
  });
});

describe("categories and units", () => {
  it("stores a plain string without an emoji", () => {
    const list = addCategory(addCategory([], "Fruit"), "Meat", "🥩");
    expect(list).toEqual(["Fruit", { name: "Meat", label: "🥩" }]);
    expect(addCategory(list, "Meat")).toEqual(list);
    expect(list.map(categoryDisplay)).toEqual(["Fruit", "🥩 Meat"]);
  });

  it("rejects built-in and existing units in any case", () => {
    expect(addCustomUnit([], "ML", "")).toEqual([]);
    const list = addCustomUnit([], "scoop", "");
    expect(list).toEqual([{ abbr: "scoop", full: "scoop" }]);
    expect(addCustomUnit(list, "Scoop", "x")).toEqual(list);
  });
});

describe("nutrients", () => {
  it("reads null as each app's defaults", () => {
    expect(visibleNutrimentIds("nt", null)).toContain("calcium");
    expect(visibleNutrimentIds("ct", null)).not.toContain("calcium");
    expect(visibleNutrimentIds("ct", [])).toContain("calories");
    expect(visibleNutrimentIds("nt", [])).toEqual([]);
  });

  it("orders and adds custom ones", () => {
    expect(orderedNutrimentIds(["proteins"])[0]).toBe("proteins");
    const list = addCustomNutriment([], "Omega 3", "mg");
    expect(list).toEqual([
      { id: "custom_omega_3", label: "Omega 3", unit: "mg" },
    ]);
    expect(addCustomNutriment(list, "omega  3", "g")).toEqual(list);
  });
});

describe("meal times", () => {
  it("fills gaps with the old defaults", () => {
    expect(mealTimesFor(3, ["07:15", ""])).toEqual(["07:15", "12:00", "18:00"]);
  });
});
