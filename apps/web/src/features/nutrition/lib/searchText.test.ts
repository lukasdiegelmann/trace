import { describe, expect, it } from "vitest";

import { foldText, includesFolded } from "./searchText";

describe("foldText", () => {
  it("drops accents and special letters", () => {
    expect(foldText("Crème Fraîche")).toBe("creme fraiche");
    expect(foldText("Łosoś Orégano Maß")).toBe("losos oregano mass");
    expect(foldText(null)).toBe("");
  });

  it("matches a query without accents", () => {
    expect(includesFolded("Plátano", "platano")).toBe(true);
    expect(includesFolded("Milk", " ")).toBe(true);
    expect(includesFolded("Milk", "oat")).toBe(false);
  });
});
