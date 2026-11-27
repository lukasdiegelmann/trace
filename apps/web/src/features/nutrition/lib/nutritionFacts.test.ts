import { describe, expect, it } from "vitest";

import {
  energyChip,
  formatFactValue,
  nutritionFacts,
  servingDescription,
} from "./nutritionFacts";
import { withDerivedFlags } from "./sources/types";

describe("nutritionFacts", () => {
  it("splits macros from vitamins and hides zeros", () => {
    const facts = nutritionFacts(
      withDerivedFlags(
        {
          calories: 100,
          fat: 0,
          "added-sugars": 2.04,
          sodium: 230,
          iron: 1.5,
          caffeine: 9,
        },
        { sodium: true },
      ),
      null,
      "kcal",
    );
    expect(facts.energy).toBe(100);
    expect(facts.macros).toEqual([
      expect.objectContaining({
        id: "added-sugars",
        text: "2",
        depth: 2,
        dvPercent: 4,
      }),
    ]);
    expect(facts.vitaminsAndMinerals.map((row) => row.id)).toEqual([
      "sodium",
      "iron",
    ]);
    expect(facts.vitaminsAndMinerals[0].isDerived).toBe(true);
  });

  it("is empty without values", () => {
    expect(nutritionFacts({}, [], "kcal").isEmpty).toBe(true);
  });

  it("formats values, the serving and the chip", () => {
    expect([2.96, 2.5, 3.0].map(formatFactValue)).toEqual(["3", "2.5", "3"]);
    expect(servingDescription({ portion: 100, unit: "ml" })).toBe("100 ml");
    expect(servingDescription({ portion: 0 })).toBeNull();
    expect(energyChip({ calories: 100 }, "kJ")).toBe(418);
    expect(energyChip({ calories: 0 }, "kcal", "none")).toBeNull();
  });
});
