import { describe, expect, it } from "vitest";

import { readBodyStat, tagBodyStats } from "./bodyStats";

describe("readBodyStat", () => {
  it("converts tagged readings into the display unit", () => {
    expect(
      readBodyStat({ weight: 80, weight_unit: "kg" }, "weight", "lb", "in"),
    ).toBe(176.4);
    expect(
      readBodyStat({ weight: 176.4, weight_unit: "lb" }, "weight", "kg", "in"),
    ).toBe(80);
    expect(
      readBodyStat({ waist: 32, lengths_unit: "in" }, "waist", "kg", "cm"),
    ).toBe(81.3);
    expect(
      readBodyStat({ waist: 81.3, lengths_unit: "cm" }, "waist", "kg", "in"),
    ).toBe(32);
  });

  it("takes untagged readings as the display unit", () => {
    expect(readBodyStat({ weight: 80 }, "weight", "lb", "in")).toBe(80);
    expect(readBodyStat({ body_fat: "18.5" }, "body_fat", "kg", "cm")).toBe(
      18.5,
    );
  });

  it("returns null for missing, empty or invalid values", () => {
    expect(readBodyStat(null, "weight", "kg", "cm")).toBeNull();
    expect(readBodyStat({ weight: "" }, "weight", "kg", "cm")).toBeNull();
    expect(readBodyStat({ weight: "abc" }, "weight", "kg", "cm")).toBeNull();
  });
});

describe("tagBodyStats", () => {
  it("tags only the kinds of fields present", () => {
    expect(tagBodyStats({ weight: 80 }, "kg", "cm")).toEqual({
      weight: 80,
      weight_unit: "kg",
    });
    expect(tagBodyStats({ waist: 80 }, "kg", "cm")).toEqual({
      waist: 80,
      lengths_unit: "cm",
    });
    expect(tagBodyStats({ body_fat: 20 }, "kg", "cm")).toEqual({
      body_fat: 20,
    });
  });
});
