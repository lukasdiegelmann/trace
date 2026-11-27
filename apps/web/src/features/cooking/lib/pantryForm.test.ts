import { describe, expect, it } from "vitest";

import { offCountryTagToFlag, offCountryTagToName } from "./offCountry";
import {
  blankDraft,
  changeServingSize,
  draftFromItem,
  draftFromPrefill,
  mergeOffProduct,
  newVariant,
  payloadFromDraft,
  variantContext,
  variantSuggestions,
} from "./pantryForm";
import { lookupCommonDensity } from "./densityLookup";
import { pantryItem } from "./testRows";

describe("pantry draft", () => {
  it("derives in_stock from the quantity", () => {
    const draft = { ...blankDraft(), name: " Rice " };
    expect(payloadFromDraft(draft)).toMatchObject({
      name: "Rice",
      in_stock: 1,
      quantity: null,
      nutrition: null,
      brand: null,
    });
    expect(payloadFromDraft({ ...draft, quantity: "0" }).in_stock).toBe(0);
    expect(payloadFromDraft({ ...draft, quantity: "1,5" }).quantity).toBe(1.5);
  });

  it("keeps the category slug of a joined row", () => {
    const draft = draftFromItem(
      pantryItem({
        id: 1,
        name: "Milk",
        category: {
          id: 3,
          name: "Dairy",
          slug: "dairy",
          icon: null,
          color: null,
        },
        category_id: 3,
      }),
    );
    expect([draft.category, draft.category_id]).toEqual(["dairy", 3]);
  });

  it("scales nutrients only when linked", () => {
    const draft = {
      ...blankDraft(),
      serving_size: "100",
      nutrition: { fat: 10 },
    };
    const loose = changeServingSize(draft, "200", false, 100);
    expect(loose.draft.nutrition.fat).toBe(10);
    const linked = changeServingSize(draft, "200", true, 100);
    expect(linked.draft.nutrition.fat).toBe(20);
    expect(linked.base).toBe(200);
    // Clearing the field keeps the base for the next keystroke.
    expect(changeServingSize(draft, "", true, 100).base).toBe(100);
  });

  it("fills blanks from OFF and merges nutrition", () => {
    const draft = {
      ...draftFromPrefill({ barcode: "1" }),
      brand: "Mine",
      nutrition: { iron: 1 },
    };
    const merged = mergeOffProduct(draft, {
      name: "Oats",
      brand: "Theirs",
      serving_size: 100,
      serving_unit: "g",
      nutrition: { sodium: 400 },
      img_url: "https://example.org/oats.jpg",
    });
    expect([merged.name, merged.brand, merged.barcode]).toEqual([
      "Oats",
      "Mine",
      "1",
    ]);
    expect(merged.nutrition).toMatchObject({ iron: 1, sodium: 400, salt: 1 });
    expect(merged.img_url).toBe("https://example.org/oats.jpg");
  });
});

describe("variants in the editor", () => {
  const milk = pantryItem({
    id: 1,
    name: "Milk",
    expires_on: "2026-06-01",
    category_id: 4,
  });
  const all = [
    milk,
    pantryItem({ id: 2, name: "Oat drink", brand: "Oatly" }),
    pantryItem({ id: 3, name: "Cheese" }),
    pantryItem({ id: 4, name: "Cheese", brand: "Oak", generic_parent_id: 3 }),
  ];

  it("offers flat rows and generics as candidates", () => {
    const context = variantContext(milk, all);
    expect(context.candidates.map((row) => [row.id, row.isGeneric])).toEqual([
      [2, false],
      [3, true],
    ]);
    expect(
      variantSuggestions(context.candidates, "oa").map((row) => row.id),
    ).toEqual([2]);
    expect(variantContext(all[2] ?? milk, all).children).toHaveLength(1);
  });

  it("moves the expiry date to the first variant", () => {
    expect(newVariant(milk, "Publix", "", true)).toEqual({
      name: "Milk",
      brand: "Publix",
      in_stock: 1,
      category_id: 4,
      generic_parent_id: 1,
      expires_on: "2026-06-01",
    });
    expect(newVariant(milk, "", "2% Milk", false)).toMatchObject({
      name: "2% Milk",
      brand: null,
      expires_on: null,
    });
  });
});

describe("lookups", () => {
  it("finds a density by name, the specific one first", () => {
    expect(lookupCommonDensity("Almond Flour")).toBe(96);
    expect(lookupCommonDensity("xylophone")).toBeNull();
  });

  it("turns OFF country tags into flags", () => {
    expect(offCountryTagToFlag("en:france")).toBe("🇫🇷");
    expect(offCountryTagToFlag("en:atlantis")).toBe("");
    expect(offCountryTagToName("en:united-states")).toBe("United States");
  });
});
