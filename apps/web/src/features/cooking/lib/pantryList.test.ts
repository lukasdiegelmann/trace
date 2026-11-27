import { describe, expect, it } from "vitest";

import {
  daysUntil,
  earliestVariantExpiry,
  effectiveExpiry,
  expiryStatus,
} from "./expiry";
import {
  autoExpandedIds,
  countPantry,
  expiringSpotlight,
  filterPantry,
  groupPantry,
  itemSlug,
  UNCATEGORIZED,
  type PantryQuery,
} from "./pantryList";
import { buildVariantsByParent } from "./pantryVariants";
import {
  availableSources,
  defaultSource,
  sourcesToSearch,
  togglePinned,
  toggleTier,
  type SourceSelection,
} from "./searchSources";
import { pantryCategory, pantryItem } from "./testRows";

const NOW = new Date(2026, 4, 14, 12);

describe("expiry", () => {
  it("warns 14 days ahead and marks the past", () => {
    expect(expiryStatus(null, NOW)).toBe("none");
    expect(expiryStatus("2026-05-13", NOW)).toBe("past");
    expect(expiryStatus("2026-05-14", NOW)).toBe("warn");
    expect(expiryStatus("2026-05-28", NOW)).toBe("warn");
    expect(expiryStatus("2026-05-29", NOW)).toBe("ok");
    expect(daysUntil("2026-05-15", NOW)).toBe(1);
  });

  it("a generic shows its worst variant", () => {
    const variants = [
      { expires_on: "2026-05-20" },
      { expires_on: "2026-05-01" },
      { expires_on: "2026-05-10" },
    ];
    expect(effectiveExpiry({}, variants, NOW)).toBe("2026-05-01");
    expect(effectiveExpiry({ expires_on: "2026-05-20" }, [], NOW)).toBe(
      "2026-05-20",
    );
    expect(effectiveExpiry({}, [{ expires_on: "2027-01-01" }], NOW)).toBeNull();
    expect(
      earliestVariantExpiry([{ expires_on: "2027-01-01" }], NOW)?.status,
    ).toBe("ok");
    expect(earliestVariantExpiry([{}], NOW)).toBeNull();
  });
});

const dairy = pantryCategory({ id: 1, name: "Dairy", slug: "dairy" });
const spice = pantryCategory({ id: 2, name: "Spices", slug: "spice" });
const categories = [dairy, spice];
const items = [
  pantryItem({ id: 1, name: "Milk", category: dairy, recipe_count: 3 }),
  pantryItem({
    id: 2,
    name: "Milk",
    brand: "Publix",
    generic_parent_id: 1,
    in_stock: false,
    expires_on: "2026-05-16",
  }),
  pantryItem({
    id: 3,
    name: "Cumin",
    category: "spice",
    in_stock: false,
    updated_at: "2026-05-01",
  }),
  pantryItem({ id: 4, name: "Abc", category: "gone" }),
  pantryItem({ id: 5, name: "Zimt", category_id: 2, expires_on: "2026-05-01" }),
];
const byParent = buildVariantsByParent(items);
const base: PantryQuery = {
  query: "",
  stockFilter: "all",
  categoryFilter: "all",
  sortKey: "name",
};
const ids = (query: Partial<PantryQuery>) =>
  filterPantry(items, byParent, categories, { ...base, ...query }, NOW).map(
    (row) => row.id,
  );

describe("pantry list", () => {
  it("reads the slug from the object, the string or the id", () => {
    expect(items.map((item) => itemSlug(item, categories))).toEqual([
      "dairy",
      null,
      "spice",
      "gone",
      "spice",
    ]);
  });

  it("filters top-level rows by stock; a generic follows its variants", () => {
    expect(ids({})).toEqual([4, 3, 1, 5]);
    expect(ids({ stockFilter: "out" })).toEqual([3, 1]);
    expect(ids({ stockFilter: "in" })).toEqual([4, 5]);
    expect(ids({ stockFilter: "expiring" })).toEqual([1, 5]);
  });

  it("filters by category and sorts", () => {
    expect(ids({ categoryFilter: "spice" })).toEqual([3, 5]);
    expect(ids({ categoryFilter: "uncategorized" })).toEqual([]);
    expect(ids({ sortKey: "usage" })[0]).toBe(1);
    expect(ids({ sortKey: "updated" })[0]).toBe(3);
  });

  it("shows a brand-only hit as a standalone variant", () => {
    const rows = filterPantry(items, byParent, categories, {
      ...base,
      query: "publix",
    });
    expect(rows.map((row) => [row.id, row.standaloneParent?.id])).toEqual([
      [2, 1],
    ]);
    expect(autoExpandedIds(items, byParent, "milk publix")).toEqual([1]);
    expect(autoExpandedIds(items, byParent, "milk")).toEqual([]);
  });

  it("groups by category and keeps orphaned slugs visible", () => {
    const rows = filterPantry(items, byParent, categories, base, NOW);
    expect(
      groupPantry(rows, categories, base).map((section) => [
        section.key,
        section.rows.map((row) => row.id),
      ]),
    ).toEqual([
      ["dairy", [1]],
      ["spice", [3, 5]],
      [UNCATEGORIZED, [4]],
    ]);
    expect(
      groupPantry(rows, categories, { ...base, sortKey: "usage" }),
    ).toHaveLength(1);
  });

  it("counts chips and the spotlight", () => {
    const counts = countPantry(items, byParent, categories, NOW);
    expect([counts.all, counts.inStock, counts.out, counts.expiring]).toEqual([
      4, 2, 2, 2,
    ]);
    expect(counts.bySlug.get("spice")).toBe(2);
    expect(
      expiringSpotlight(items, byParent, NOW).map((entry) => entry.item.id),
    ).toEqual([5, 1]);
  });
});

describe("search sources", () => {
  const settings = {
    offEnabled: true,
    usdaEnabled: true,
    usdaApiKey: "",
    ntFederationEnabled: true,
  };

  it("offers only enabled sources; All from two up", () => {
    expect(availableSources(settings)).toEqual(["all", "local", "off", "nt"]);
    expect(
      availableSources({
        ...settings,
        offEnabled: false,
        ntFederationEnabled: false,
      }),
    ).toEqual(["local"]);
    expect(defaultSource("usda", settings)).toBe("local");
    expect(defaultSource("off", settings)).toBe("off");
  });

  it("pins several sources and falls back to one", () => {
    let selection: SourceSelection = { source: "off", pinned: new Set() };
    selection = togglePinned(selection, "nt");
    expect(selection.source).toBe("all");
    expect([...selection.pinned]).toEqual(["off", "nt"]);
    expect(sourcesToSearch(selection, settings)).toEqual(["off", "nt"]);
    selection = togglePinned(selection, "nt");
    expect(selection).toEqual({ source: "off", pinned: new Set() });
    expect(
      sourcesToSearch({ source: "all", pinned: new Set() }, settings),
    ).toEqual(["off", "nt"]);
    expect(
      sourcesToSearch({ source: "local", pinned: new Set() }, settings),
    ).toEqual([]);
  });

  it("never hides every quality tier", () => {
    expect([...toggleTier(new Set(["hi", "lo"]), "lo")]).toEqual(["hi"]);
    expect([...toggleTier(new Set(["hi"]), "hi")]).toEqual(["hi"]);
  });
});
