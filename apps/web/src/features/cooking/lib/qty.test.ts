import { describe, expect, it } from "vitest";

import {
  displayQty,
  displayQtyParts,
  formatQty,
  normaliseQtyForUnit,
  parseQty,
  scaleQty,
} from "./qty";

describe("quantities", () => {
  it("parses integers, decimals, fractions and mixed numbers", () => {
    expect(parseQty("2")).toBe(2);
    expect(parseQty("0.5")).toBe(0.5);
    expect(parseQty("1/2")).toBe(0.5);
    expect(parseQty("1 1/2")).toBe(1.5);
    expect(parseQty("1 and 1/2")).toBe(1.5);
    expect(parseQty("to taste")).toBeNull();
    expect(parseQty("1/0")).toBeNull();
    expect(parseQty("")).toBeNull();
  });

  it("snaps to cooking fractions", () => {
    expect(formatQty(0.25)).toBe("1/4");
    expect(formatQty(1.6667)).toBe("1 2/3");
    expect(formatQty(1.99)).toBe("2");
    expect(formatQty(0.2)).toBe("0.2");
    expect(formatQty(-1)).toBe("-1");
  });

  it("scales and keeps what it cannot read", () => {
    expect(scaleQty("1/2", 2)).toBe("1");
    expect(scaleQty("to taste", 3)).toBe("to taste");
  });

  it("uses fractions only for US volumes", () => {
    expect(displayQty("0.25", "cup")).toBe("1/4");
    expect(displayQty("0.5", "tsp")).toBe("1/2");
    expect(displayQty("1.5", "g")).toBe("1.5");
    expect(displayQty("100", "g", 2)).toBe("200");
    expect(displayQty("to taste", "g", 2)).toBe("to taste");
    expect(displayQtyParts("1.5", "cup")).toEqual({
      whole: "1",
      fraction: "1/2",
    });
    expect(displayQtyParts("0.5", "g")).toEqual({
      whole: "0.5",
      fraction: "",
    });
  });

  it("tidies a typed quantity for fraction units", () => {
    expect(normaliseQtyForUnit("0.75", "cup")).toBe("3/4");
    expect(normaliseQtyForUnit("0.75", "g")).toBe("0.75");
    expect(normaliseQtyForUnit("a bit", "cup")).toBe("a bit");
  });
});
