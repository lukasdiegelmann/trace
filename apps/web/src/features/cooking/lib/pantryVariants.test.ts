/**
 * The original's cases: cooktrace/scripts/pantry-stock-toggle.test.js and
 * pantry-search-accents.test.js, plus search-fold.test.js for the folding.
 */
import { describe, expect, it } from "vitest";

import {
  aggregateStock,
  buildVariantsByParent,
  classifySearchHit,
  displayVariantName,
  isItemInStock,
  matchesSearch,
  matchingVariants,
  nextStockToggle,
  queryHitVariant,
  topLevelItems,
  type VariantRow,
} from "./pantryVariants";
import { coversFolded, foldText, includesFolded } from "./searchText";

describe("isItemInStock and the quick toggle", () => {
  it("a blank On Hand is not zero", () => {
    expect(isItemInStock({ in_stock: 1, quantity: null })).toBe(true);
    expect(isItemInStock({ quantity: null })).toBe(true);
    expect(isItemInStock({ quantity: "" })).toBe(true);
  });

  it("in_stock decides when present, quantity only as a fallback", () => {
    expect(isItemInStock({ in_stock: 0, quantity: null })).toBe(false);
    expect(isItemInStock({ in_stock: 0, quantity: 0 })).toBe(false);
    expect(isItemInStock({ in_stock: 1, quantity: 3 })).toBe(true);
    expect(isItemInStock({ quantity: 0 })).toBe(false);
    expect(isItemInStock({ quantity: 2 })).toBe(true);
    expect(isItemInStock(null)).toBe(false);
  });

  it("out -> in with On Hand 1 -> out with On Hand 0", () => {
    let item: VariantRow = { id: 1, in_stock: 0, quantity: 0 };
    item = { ...item, ...nextStockToggle(item) };
    expect([item.in_stock, item.quantity]).toEqual([1, 1]);
    item = { ...item, ...nextStockToggle(item) };
    expect([item.in_stock, item.quantity]).toEqual([0, 0]);
  });

  it("an item in stock with a blank On Hand can be marked out", () => {
    expect(nextStockToggle({ in_stock: 1, quantity: null })).toEqual({
      in_stock: 0,
      quantity: 0,
    });
  });

  it("marking in keeps a quantity that is already there", () => {
    expect(nextStockToggle({ in_stock: 0, quantity: 4 })).toEqual({
      in_stock: 1,
      quantity: 4,
    });
  });
});

describe("accent-folded pantry search", () => {
  const items: VariantRow[] = [
    { id: 1, name: "Orégano seco" },
    { id: 2, name: "Café" },
    { id: 3, name: "Limón" },
    { id: 4, name: "Jalapeño" },
    { id: 5, name: "Leite", brand: "Itambé" },
    { id: 6, name: "Whole milk" },
    { id: 7, name: "Queso", generic_parent_id: null },
    { id: 8, name: "Queso", brand: "La Serenísima", generic_parent_id: 7 },
  ];
  const byParent = buildVariantsByParent(items);
  const find = (query: string) =>
    topLevelItems(items)
      .filter((item) => matchesSearch(item, byParent, query))
      .map((item) => item.id);

  it("a query without accents finds an accented name", () => {
    expect(find("oregano")).toEqual([1]);
    expect(find("orega")).toEqual([1]);
    expect(find("cafe")).toEqual([2]);
    expect(find("limon")).toEqual([3]);
    expect(find("jalapeno")).toEqual([4]);
  });

  it("a query with accents still finds the name", () => {
    expect(find("orégano")).toEqual([1]);
    expect(find("Oregano Seco")).toEqual([1]);
  });

  it("brands fold too, including a variant brand", () => {
    expect(find("itambe")).toEqual([5]);
    expect(classifySearchHit(items[6], byParent, "serenisima")).toBe(
      "variants",
    );
  });

  it("English names match exactly as before", () => {
    expect(find("milk")).toEqual([6]);
    expect(find("whole milk")).toEqual([6]);
    expect(find("oat")).toEqual([]);
  });
});

describe("variant hierarchy", () => {
  const milk: VariantRow = { id: 1, name: "Whole Milk" };
  const greenwise: VariantRow = {
    id: 2,
    name: "Whole Milk",
    brand: "GreenWise",
    generic_parent_id: 1,
    in_stock: 1,
  };
  const publix: VariantRow = {
    id: 3,
    name: "Whole Milk",
    brand: "Publix",
    generic_parent_id: 1,
    in_stock: 0,
  };
  const twoPercent: VariantRow = {
    id: 4,
    name: "2% Milk",
    generic_parent_id: 1,
  };
  const items = [publix, milk, greenwise, twoPercent];
  const byParent = buildVariantsByParent(items);

  it("names variants by context", () => {
    expect(displayVariantName(greenwise, milk, { isNested: true })).toBe(
      "GreenWise",
    );
    expect(displayVariantName(greenwise, milk)).toBe("Whole Milk (GreenWise)");
    expect(displayVariantName(twoPercent, milk, { isNested: true })).toBe(
      "2% Milk",
    );
    expect(displayVariantName(null, milk)).toBe("");
  });

  it("groups variants under their parent, sorted by brand", () => {
    expect(byParent.get(1)?.map((v) => v.id)).toEqual([4, 2, 3]);
    expect(topLevelItems(items).map((i) => i.id)).toEqual([1]);
  });

  it("aggregates stock over the variants", () => {
    expect(aggregateStock(milk, byParent)).toEqual({
      stocked: 1,
      total: 3,
      isGeneric: true,
    });
    expect(aggregateStock(greenwise, byParent)).toEqual({
      stocked: 1,
      total: 1,
      isGeneric: false,
    });
  });

  it("classifies a search hit", () => {
    expect(classifySearchHit(milk, byParent, "")).toBe("parent");
    expect(classifySearchHit(milk, byParent, "whole milk")).toBe("parent");
    expect(classifySearchHit(milk, byParent, "greenwise milk")).toBe(
      "expanded",
    );
    expect(classifySearchHit(milk, byParent, "publix")).toBe("variants");
    expect(classifySearchHit(milk, byParent, "oat")).toBeNull();
    expect(queryHitVariant(milk, byParent, "greenwise milk")).toBe(true);
    expect(queryHitVariant(milk, byParent, "milk")).toBe(false);
    expect(matchingVariants(milk, byParent, "publix").map((v) => v.id)).toEqual(
      [3],
    );
  });
});

describe("search folding", () => {
  it("drops accents and leaves plain text alone", () => {
    expect(foldText("Orégano")).toBe("oregano");
    expect(foldText("Crème fraîche")).toBe("creme fraiche");
    expect(foldText("Whole Milk")).toBe("whole milk");
    expect(foldText("Straße")).toBe("strasse");
    expect(foldText("Ølsuppe")).toBe("olsuppe");
    expect(foldText("Łosoś")).toBe("losos");
    expect(foldText("Æbleskiver")).toBe("aebleskiver");
    expect(foldText(null)).toBe("");
    expect(foldText(42)).toBe("42");
  });

  it("includesFolded and coversFolded", () => {
    expect(includesFolded("Orégano seco", "oregano")).toBe(true);
    expect(includesFolded("Café con leche", "CAFE")).toBe(true);
    expect(includesFolded("anything", "")).toBe(true);
    expect(includesFolded("Orégano", "basil")).toBe(false);
    expect(coversFolded("Whole milk Itambé", "itambe milk")).toBe(true);
    expect(coversFolded("Whole milk", "milk oat")).toBe(false);
  });
});
