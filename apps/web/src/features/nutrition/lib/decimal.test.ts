import { describe, expect, it } from "vitest";

import { parseDecimal, parsePositive, toInputValue } from "./decimal";

describe("parseDecimal", () => {
  it("accepts comma and dot", () => {
    expect(parseDecimal("2,5")).toBe(2.5);
    expect(parseDecimal(" 2.5 ")).toBe(2.5);
    expect(parseDecimal(3)).toBe(3);
  });

  it("is NaN for empty and garbage", () => {
    expect(parseDecimal("")).toBeNaN();
    expect(parseDecimal("abc")).toBeNaN();
    expect(parseDecimal(null)).toBeNaN();
  });

  it("parsePositive and toInputValue", () => {
    expect(parsePositive("0")).toBeNull();
    expect(parsePositive("1,2")).toBe(1.2);
    expect(toInputValue(0.130491518)).toBe("0.1305");
    expect(toInputValue(null)).toBe("");
    expect(toInputValue(0)).toBe("0");
  });
});
