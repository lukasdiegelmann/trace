import { describe, expect, it } from "vitest";

import { nutrientFields, nutrientTotalRows } from "./nutrientFields";
import { DEFAULT_VISIBLE_NUTRIMENT_IDS, NUTRIMENTS } from "./nutrition";

const customs = [{ id: "c_zinc2", label: "Q10", unit: "mg" }];

describe("nutrientFields", () => {
  it("shows the defaults plus customs, or all", () => {
    for (const visibleNutriments of [null, []]) {
      const ids = nutrientFields({
        visibleNutriments,
        customNutriments: customs,
      }).map((field) => field.id);
      expect(ids).toEqual([...DEFAULT_VISIBLE_NUTRIMENT_IDS, "c_zinc2"]);
    }
    expect(nutrientFields({}, true)).toHaveLength(NUTRIMENTS.length);
  });

  it("puts ordered ids first", () => {
    const fields = nutrientFields({
      visibleNutriments: ["calories", "fat", "proteins"],
      nutrimentsOrder: ["c_zinc2", "proteins"],
      customNutriments: customs,
    });
    expect(fields.map((field) => field.id)).toEqual([
      "c_zinc2",
      "proteins",
      "calories",
      "fat",
    ]);
    expect(fields[0]).toMatchObject({ label: "Q10", isCustom: true });
  });

  it("totals include customs and show kJ", () => {
    const rows = nutrientTotalRows(
      { calories: 100, proteins: 1.25, fat: 0, c_zinc2: 3 },
      { customNutriments: customs },
      "kJ",
    );
    expect(rows.map((row) => [row.field.id, row.value, row.unit])).toEqual([
      ["calories", 418, "kJ"],
      ["proteins", 1.3, "g"],
      ["c_zinc2", 3, "mg"],
    ]);
  });
});
