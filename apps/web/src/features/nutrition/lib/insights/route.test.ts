import { describe, expect, it } from "vitest";

import { moveItem, toggleValue } from "./order";
import { downsample, heartRateShares } from "./route";

describe("route", () => {
  it("keeps the ends when thinning points out", () => {
    const thinned = downsample([0, 1, 2, 3, 4, 5, 6, 7, 8], 5);
    expect(thinned).toEqual([0, 2, 4, 6, 8]);
    expect(downsample([1, 2], 5)).toEqual([1, 2]);
  });

  it("shares the route between heart-rate zones", () => {
    expect(
      heartRateShares([{ hr: 120 }, { hr: 160 }, { hr: 160 }, { hr: null }]),
    ).toEqual([
      { zone: "easy", pct: (1 / 3) * 100 },
      { zone: "hard", pct: (2 / 3) * 100 },
    ]);
    expect(heartRateShares([{ hr: null }])).toBeNull();
  });
});

describe("order", () => {
  it("moves an item and stays at the ends", () => {
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  it("toggles a value", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });
});
