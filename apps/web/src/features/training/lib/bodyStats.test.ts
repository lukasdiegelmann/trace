import { describe, expect, it } from "vitest";

import {
  bodyStatUnit,
  formatBodyStatsDate,
  mergeBodyStatsDrafts,
  parseBodyStatsResponse,
  parseWeightInput,
  visibleBodyStats,
  widgetMeasurementRows,
} from "./bodyStats";

describe("body stats", () => {
  it("reads nested, string and flat answers (issue #80)", () => {
    expect(
      parseBodyStatsResponse({ stats: { stats: { weight: 80 } } }),
    ).toEqual({ weight: 80 });
    expect(
      parseBodyStatsResponse({ stats: { stats: '{"weight":81}' } }),
    ).toEqual({ weight: 81 });
    expect(parseBodyStatsResponse({ stats: { weight: 82 } })).toEqual({
      weight: 82,
    });
    expect(parseBodyStatsResponse({ stats: null })).toEqual({});
    expect(parseBodyStatsResponse({ stats: "{bad" })).toEqual({});
  });

  it("shows only tracked stats, in a fixed order", () => {
    expect(visibleBodyStats(["calves", "weight"])).toEqual([
      "weight",
      "calves",
    ]);
    expect(
      widgetMeasurementRows({ waist: 80, hips: "", weight: 90 }, [
        "weight",
        "waist",
        "hips",
      ]),
    ).toEqual([{ id: "waist", value: 80 }]);
  });

  it("units follow the weight unit without conversion", () => {
    expect(bodyStatUnit("weight", "kg")).toBe("kg");
    expect(bodyStatUnit("bodyFat", "kg")).toBe("%");
    expect(bodyStatUnit("waist", "kg")).toBe("cm");
    expect(bodyStatUnit("waist", "lbs")).toBe("in");
  });

  it("formats the date by setting", () => {
    expect(formatBodyStatsDate("2026-11-26", "EU")).toBe("26/11/2026");
    expect(formatBodyStatsDate("2026-11-26", "US")).toBe("11/26/2026");
    expect(formatBodyStatsDate("2026-11-26", "ISO")).toBe("2026-11-26");
  });

  it("keeps untouched values and clears emptied ones", () => {
    expect(
      mergeBodyStatsDrafts(
        { weight: 80, neck: 40 },
        { neck: "", chest: "100" },
      ),
    ).toEqual({ weight: 80, neck: null, chest: 100 });
    expect(parseWeightInput("80.5")).toBe(80.5);
    expect(parseWeightInput("0")).toBeNull();
    expect(parseWeightInput("x")).toBeNull();
  });
});
