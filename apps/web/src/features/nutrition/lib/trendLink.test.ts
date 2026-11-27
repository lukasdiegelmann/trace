import { describe, expect, it } from "vitest";

import { trendPath } from "./trendLink";

describe("trendPath", () => {
  it("links nutrients, body stats and water to their series", () => {
    expect(trendPath("calories")).toBe(
      "/nutrition/statistics?metric=calories&range=1M",
    );
    expect(trendPath("waist")).toContain("metric=waist&");
    expect(trendPath("water")).toContain("metric=water&");
  });

  it("maps wellness goals and skips those without a series", () => {
    expect(trendPath("steps")).toContain("metric=wl_steps&");
    expect(trendPath("floors")).toBeNull();
    expect(trendPath("something")).toBeNull();
  });
});
