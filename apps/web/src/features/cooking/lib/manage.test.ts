import { describe, expect, it } from "vitest";

import {
  asManageSection,
  customUnitProblem,
  matchesUnit,
  mergeTarget,
  moveItem,
  taxonomyView,
} from "./manage";
import { buildShoppingCardSvg, buildShoppingText } from "./shoppingCard";

const tags = [
  { name: "vegan", count: 2 },
  { name: "Crème", count: 0 },
  { name: "asia", count: 5 },
];

describe("manage", () => {
  it("sorts, filters and shows unused taxonomy", () => {
    const names = (...args: Parameters<typeof taxonomyView>) =>
      taxonomyView(...args).map((item) => item.name);
    expect(names(tags, "", "name", false)).toEqual(["asia", "Crème", "vegan"]);
    expect(names(tags, "", "most", false)[0]).toBe("asia");
    expect(names(tags, "", "least", false)[0]).toBe("Crème");
    expect(names(tags, "creme", "name", false)).toEqual(["Crème"]);
    expect(names(tags, "", "name", true)).toEqual(["Crème"]);
  });

  it("detects a merge and moves entries", () => {
    expect(mergeTarget(tags, "vegan", " ASIA ")?.name).toBe("asia");
    expect(mergeTarget(tags, "vegan", "Vegan")).toBeNull();
    expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toBeNull();
    expect(asManageSection("units")).toBe("units");
    expect(asManageSection("nope")).toBe("recipe-categories");
  });

  it("rejects colliding custom units", () => {
    const custom = [
      { id: 1, abbr: "Msp", full_name: null, category: "Custom" },
    ];
    expect(customUnitProblem("cup", custom)).toBe("builtin");
    expect(customUnitProblem("msp", custom)).toBe("duplicate");
    expect(customUnitProblem("heap", custom)).toBeNull();
    expect(matchesUnit({ abbr: "tbsp", full: "tablespoon" }, "table")).toBe(
      true,
    );
  });
});

describe("shopping share", () => {
  const texts = {
    title: "List",
    itemCount: (count: number) => `${count} items`,
    itemCountShort: (count: number) => `${count} ITEMS`,
    more: (count: number) => `+${count} more`,
    signature: "— Trace",
    date: "May 4, 2026",
  };
  const items = [
    { name: "Eggs <6>", quantity: 6, unit: "pc" },
    { name: "Milk", checked: true },
  ];

  it("lists what is still to buy as text", () => {
    expect(buildShoppingText(items, texts)).toBe(
      "🛒 List (1 items)\nMay 4, 2026\n\n• Eggs <6> — 6 pc\n\n— Trace",
    );
  });

  it("escapes names and caps the card at 32 rows", () => {
    expect(buildShoppingCardSvg(items, texts).svg).toContain("Eggs &lt;6&gt;");
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `n${i}` }));
    expect(buildShoppingCardSvg(many, texts).svg).toContain("+9 more");
  });
});
