import { describe, expect, it } from "vitest";

import {
  BUILTIN_UNIT_ABBRS,
  orderUnitGroups,
  UNIT_GROUPS,
  unitGroupLabelKey,
  unitGroupsMerged,
} from "./units";

describe("unitGroupsMerged", () => {
  it("returns the built-ins without an overlay", () => {
    expect(unitGroupsMerged(null).map((g) => g.label)).toEqual(
      UNIT_GROUPS.map((g) => g.label),
    );
    expect(BUILTIN_UNIT_ABBRS.has("tbsp")).toBe(true);
  });

  it("drops disabled built-ins and empty groups", () => {
    const groups = unitGroupsMerged({ disabled: ["oz", "lb", "tsp"] });
    expect(groups.find((g) => g.label === "Weight — US")).toBeUndefined();
    expect(
      groups
        .find((g) => g.label === "Volume — US")
        ?.units.some((unit) => unit.abbr === "tsp"),
    ).toBe(false);
  });

  it("files customs under their category, loose ones in Custom on top", () => {
    const groups = unitGroupsMerged({
      custom: [
        { id: 1, abbr: "Msp", full_name: "Messerspitze", category: "Custom" },
        { id: 2, abbr: "EL", full_name: null, category: "Volume — Metric" },
        { id: 3, abbr: "x", full_name: "x", category: "Unknown" },
      ],
    });
    expect(groups[0]?.label).toBe("Custom");
    expect(groups[0]?.units.map((unit) => unit.abbr)).toEqual(["Msp", "x"]);
    const metric = groups.find((g) => g.label === "Volume — Metric");
    expect(metric?.units.at(-1)).toEqual({ abbr: "EL", full: "EL" });
  });

  it("lists metric groups first for the metric system", () => {
    const groups = unitGroupsMerged({
      custom: [{ id: 1, abbr: "x", full_name: "x", category: "Custom" }],
    });
    expect(orderUnitGroups(groups, "metric").map((g) => g.label)).toEqual([
      "Custom",
      "Volume — Metric",
      "Weight — Metric",
      "Volume — US",
      "Weight — US",
      "Count / descriptive",
    ]);
    expect(orderUnitGroups(groups, "imperial")).toEqual(groups);
  });

  it("maps stored group labels to translation keys", () => {
    expect(unitGroupLabelKey("Weight — Metric")).toBe("weightMetric");
    expect(unitGroupLabelKey("Custom")).toBe("custom");
    expect(unitGroupLabelKey("Other")).toBeUndefined();
  });
});
