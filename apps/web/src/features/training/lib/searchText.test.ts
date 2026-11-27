import { describe, expect, it } from "vitest";

import {
  coversFolded,
  foldText,
  includesFolded,
  stripAccents,
} from "./searchText";

// Cases from backends/lifttrace/scripts/search-fold.test.js
describe("searchText", () => {
  it("folds accents and special letters", () => {
    expect(foldText("Prédicateur")).toBe("predicateur");
    expect(foldText("Straße")).toBe("strasse");
    expect(foldText("Ølsuppe")).toBe("olsuppe");
    expect(foldText("Łosoś")).toBe("losos");
  });

  it("stripAccents leaves letters NFD cannot reach", () => {
    expect(stripAccents("Straße")).toBe("straße");
    expect(stripAccents("Café")).toBe("cafe");
  });

  it("is idempotent and safe on null", () => {
    expect(foldText(foldText("Crème fraîche"))).toBe(foldText("Crème fraîche"));
    expect(foldText(null)).toBe("");
    expect(foldText(undefined)).toBe("");
  });

  it("matches in both directions of accenting; empty query matches", () => {
    expect(includesFolded("Orégano", "oregano")).toBe(true);
    expect(includesFolded("Oregano", "orégano")).toBe(true);
    expect(includesFolded("anything", "")).toBe(true);
    expect(includesFolded("Squat", "bench")).toBe(false);
  });

  it("covers every token in any order", () => {
    expect(coversFolded("Curl bíceps con barra", "barra biceps")).toBe(true);
    expect(coversFolded("Whole milk", "milk whole")).toBe(true);
    expect(coversFolded("Whole milk", "milk skim")).toBe(false);
  });
});
