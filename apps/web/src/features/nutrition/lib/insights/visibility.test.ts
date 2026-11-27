import { describe, expect, it } from "vitest";

import { clampDays, SETTINGS_VISIBILITY_IDS } from "./visibility";
import { toggleMetric } from "./wellness";

describe("wellness settings", () => {
  it("clamps a typed sync range", () => {
    expect(clampDays("500", 365)).toBe(365);
    expect(clampDays("0", 365)).toBe(1);
    expect(clampDays("", 180)).toBe(1);
    expect(clampDays("45", 180)).toBe(45);
  });

  it("turns one metric off and keeps all the others on", () => {
    const next = toggleMetric(null, "steps", SETTINGS_VISIBILITY_IDS);
    expect(next).toHaveLength(SETTINGS_VISIBILITY_IDS.length - 1);
    expect(next).toContain("body_temperature");
    expect(next).not.toContain("steps");
  });
});
