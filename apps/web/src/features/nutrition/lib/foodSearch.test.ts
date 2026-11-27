import { describe, expect, it } from "vitest";

import {
  arrangeLibrary,
  categoryDisplay,
  editDistance,
  matchesFood,
  sortLibrary,
} from "./foodSearch";

describe("matchesFood", () => {
  const food = { name: "Crème Fraîche", brand: "Müller" };

  it("matches substrings, all words and typos, accents aside", () => {
    expect(matchesFood(food, "creme")).toBe(true);
    expect(matchesFood(food, "muller creme")).toBe(true);
    expect(matchesFood(food, "fraiche mullr")).toBe(true);
    expect(matchesFood(food, "")).toBe(true);
    expect(matchesFood(food, "yoghurt")).toBe(false);
  });

  it("allows no typos in short words", () => {
    expect(matchesFood({ name: "Egg" }, "eag")).toBe(false);
    expect(editDistance("abc", "abcdef")).toBe(99);
    expect(editDistance("milk", "mlik")).toBe(2);
  });
});

describe("sorting", () => {
  const items = [
    { name: "c", usage_count: 1, last_used_at: "2026-01-01" },
    { name: "b", usage_count: 5, last_used_at: null, favorite: 0 },
    { name: "a", usage_count: 1, last_used_at: "2026-02-01" },
    { name: "d", favorite: 1, category: "x" },
  ];
  const names = (list: { name: string }[]) =>
    list.map((item) => item.name).join("");

  it("sorts alpha, recent (never used last) and most used", () => {
    expect(names(sortLibrary(items, "alpha"))).toBe("abcd");
    expect(names(sortLibrary(items, "recent"))).toBe("acbd");
    expect(names(sortLibrary(items, "most"))).toBe("bacd");
  });

  it("pins favourites when unfiltered, or always for the picker", () => {
    expect(names(arrangeLibrary(items, { sort: "alpha" }))).toBe("dabc");
    const many = [...items, { name: "ad", favorite: 0 }];
    expect(names(arrangeLibrary(many, { sort: "alpha", query: "d" }))).toBe(
      "add",
    );
    expect(
      names(
        arrangeLibrary(many, {
          sort: "alpha",
          query: "d",
          pinning: "always",
        }),
      ),
    ).toBe("dad");
    expect(names(arrangeLibrary(items, { sort: "alpha", category: "x" }))).toBe(
      "d",
    );
  });

  it("shows category labels when asked", () => {
    expect(categoryDisplay({ name: "Fruit", label: "🍎" }, true)).toBe(
      "🍎 Fruit",
    );
    expect(categoryDisplay({ name: "Fruit", label: "🍎" }, false)).toBe(
      "Fruit",
    );
    expect(categoryDisplay("Fruit", true)).toBe("Fruit");
  });
});
