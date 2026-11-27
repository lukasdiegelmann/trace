import { describe, expect, it } from "vitest";

import { readBodyStat, orderBodyStats } from "./bodyStats";
import { calculateItem, sumNutrition } from "./nutrition";
import {
  availableMetrics,
  buildSeries,
  chartBaseline,
  completionStats,
  emptyAlternatives,
  groupByMonth,
  initialMetric,
  linearRegression,
  quickRange,
  rangeDays,
  summarize,
  toCsv,
  trendLine,
  visibleMetrics,
  weeklyTrend,
  type DayValue,
  type MetricListOptions,
  type SeriesOptions,
} from "./statistics";

const LIST: MetricListOptions = {
  hiddenBodyStats: [],
  isWaterShownInStats: true,
  wellnessMetrics: null,
  isFitbitFamilyEnabled: false,
  isGarminEnabled: false,
  isWithingsEnabled: false,
};

const OPTIONS: SeriesOptions = {
  energyUnit: "kcal",
  weightUnit: "kg",
  lengthUnit: "cm",
  waterUnit: "ml",
  isFitbitFamilyEnabled: false,
  isGarminEnabled: false,
  isWithingsEnabled: false,
  isTodayIncluded: false,
  today: "2026-11-25",
};

const NO_DEVICES = { fitbit: {}, garmin: {}, withings: {} };

describe("metric list", () => {
  it("lists default nutriments, body stats, water; wellness only with a device", () => {
    const keys = availableMetrics(LIST).map((m) => m.key);
    expect(keys).toContain("calories");
    expect(keys).not.toContain("kilojoules");
    expect(keys).toContain("body_water");
    expect(keys).toContain("water");
    expect(keys.some((k) => k.startsWith("wl_"))).toBe(false);
  });

  it("gates wellness series on integrations and wellnessMetrics", () => {
    const withGarmin = availableMetrics({
      ...LIST,
      isGarminEnabled: true,
      wellnessMetrics: ["steps", "resting_hr"],
    }).map((m) => m.key);
    expect(withGarmin).toEqual(expect.arrayContaining(["wl_steps", "wl_rhr"]));
    expect(withGarmin).not.toContain("wl_hrv");
    expect(withGarmin).not.toContain("wl_muscle");
    const withWithings = availableMetrics({ ...LIST, isWithingsEnabled: true });
    expect(withWithings.map((m) => m.key)).toEqual(
      expect.arrayContaining(["wl_muscle"]),
    );
  });

  it("drops hidden body stats and water when off", () => {
    const keys = availableMetrics({
      ...LIST,
      hiddenBodyStats: ["neck"],
      isWaterShownInStats: false,
    }).map((m) => m.key);
    expect(keys).not.toContain("neck");
    expect(keys).not.toContain("water");
  });

  it("applies the hide list, then the order, appending the rest", () => {
    const keys = visibleMetrics(LIST, ["fat"], ["weight", "calories"]).map(
      (m) => m.key,
    );
    expect(keys.slice(0, 2)).toEqual(["weight", "calories"]);
    expect(keys).not.toContain("fat");
    expect(keys).toContain("proteins");
  });

  it("opens on the first available ordered metric (#155)", () => {
    const available = availableMetrics(LIST);
    expect(initialMetric(["wl_steps", "weight"], [], available, "kcal")).toBe(
      "weight",
    );
    expect(initialMetric(["weight"], ["weight"], available, "kcal")).toBe(
      "calories",
    );
    expect(initialMetric([], [], available, "kJ")).toBe("kilojoules");
  });
});

describe("rangeDays", () => {
  it("covers the last n days", () => {
    const days = rangeDays("7", {
      today: "2026-11-25",
      isDeviceSeries: false,
      diaryDays: [],
    });
    expect(days).toEqual([
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
    ]);
  });

  it("'all' is the diary's days, or 365 days for device series", () => {
    expect(
      rangeDays("all", {
        isDeviceSeries: false,
        diaryDays: ["2026-02-01", "2026-01-01", "2026-02-01"],
      }),
    ).toEqual(["2026-01-01", "2026-02-01"]);
    expect(
      rangeDays("all", {
        today: "2026-11-25",
        isDeviceSeries: true,
        diaryDays: [],
      }),
    ).toHaveLength(365);
  });

  it("refuses an incomplete or backwards custom range", () => {
    const base = { isDeviceSeries: false, diaryDays: [] };
    expect(
      rangeDays("custom", { ...base, customStart: "2026-01-02" }),
    ).toBeNull();
    expect(
      rangeDays("custom", {
        ...base,
        customStart: "2026-01-03",
        customEnd: "2026-01-02",
      }),
    ).toBeNull();
    expect(
      rangeDays("custom", {
        ...base,
        customStart: "2026-01-01",
        customEnd: "2026-01-03",
      }),
    ).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("has the quick picks of the custom range", () => {
    expect(quickRange("last7", "2026-03-10")).toEqual({
      start: "2026-03-04",
      end: "2026-03-10",
    });
    expect(quickRange("lastMonth", "2026-03-10")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(quickRange("thisMonth", "2026-03-10").start).toBe("2026-03-01");
    expect(quickRange("yearToDate", "2026-03-10").start).toBe("2026-01-01");
  });
});

describe("buildSeries", () => {
  const diary = {
    "2026-11-23": {
      date: "2026-11-23",
      items: [
        { quantity: 2, nutrition: { calories: 100, proteins: 5 } },
        { quantity: 1, nutrition: { calories: 50 } },
      ],
      water: [{ amount: 250 }, { amount: 500 }],
      body_stats: {
        weight: 180,
        weight_unit: "lb",
        waist: 32,
        lengths_unit: "in",
      },
    },
    "2026-11-24": { date: "2026-11-24", items: [], water: [] },
    "2026-11-25": {
      date: "2026-11-25",
      items: [{ quantity: 1, nutrition: { calories: 10 } }],
    },
  };
  const days = ["2026-11-23", "2026-11-24", "2026-11-25"];

  it("sums nutrients; a day without food is null, missing nutrient 0 (#45)", () => {
    const rows = buildSeries(
      "proteins",
      days,
      { diary, ...NO_DEVICES },
      { ...OPTIONS, isTodayIncluded: true },
    );
    expect(rows).toEqual([
      { date: "2026-11-23", val: 10 },
      { date: "2026-11-24", val: null },
      { date: "2026-11-25", val: 0 },
    ]);
  });

  it("drops today from cumulative metrics unless included", () => {
    const rows = buildSeries(
      "calories",
      days,
      { diary, ...NO_DEVICES },
      OPTIONS,
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-11-23", "2026-11-24"]);
    expect(rows[0].val).toBe(250);
  });

  it("converts calories to kJ", () => {
    const rows = buildSeries(
      "calories",
      ["2026-11-23"],
      { diary, ...NO_DEVICES },
      { ...OPTIONS, energyUnit: "kJ" },
    );
    expect(rows[0].val).toBe(1046);
  });

  it("sums water and converts body stats to the current units", () => {
    const sources = { diary, ...NO_DEVICES };
    expect(buildSeries("water", days, sources, OPTIONS)[0].val).toBe(750);
    expect(buildSeries("weight", days, sources, OPTIONS)[0].val).toBe(81.6);
    expect(buildSeries("waist", days, sources, OPTIONS)[0].val).toBe(81.3);
  });

  it("reads device body metrics first, then falls back to the diary", () => {
    const rows = buildSeries(
      "weight",
      ["2026-11-23", "2026-11-24"],
      {
        diary,
        fitbit: {},
        garmin: {},
        withings: { "2026-11-24": { weight_kg: { value: 80 } } },
      },
      { ...OPTIONS, isWithingsEnabled: true },
    );
    expect(rows).toEqual([
      { date: "2026-11-23", val: 81.6 },
      { date: "2026-11-24", val: 80 },
    ]);
  });

  it("reads wellness Garmin first, sleep in hours", () => {
    const rows = buildSeries(
      "wl_sleep",
      ["2026-11-24"],
      {
        diary: {},
        withings: {},
        garmin: { "2026-11-24": { sleep_duration_min: 450 } },
        fitbit: { "2026-11-24": { sleep_duration_min: 400 } },
      },
      { ...OPTIONS, isGarminEnabled: true },
    );
    expect(rows).toEqual([{ date: "2026-11-24", val: 7.5 }]);
  });
});

describe("summary and trends", () => {
  const rows: DayValue[] = [
    { date: "a", val: 1 },
    { date: "b", val: null },
    { date: "c", val: 0 },
    { date: "d", val: 5 },
  ];

  it("summarizes logged days; 0 counts, null doesn't", () => {
    expect(summarize(rows)).toEqual({
      avg: 2,
      min: 0,
      max: 5,
      total: 6,
      daysWithData: 3,
    });
    expect(summarize([{ date: "a", val: null }])).toBeNull();
  });

  it("fits a least-squares line", () => {
    expect(
      linearRegression([
        { x: 0, y: 1 },
        { x: 1, y: 3 },
        { x: 2, y: 5 },
      ]),
    ).toEqual([1, 3, 5]);
    expect(linearRegression([{ x: 0, y: 1 }])).toBeNull();
  });

  it("fits the trend through positive values and spans the gaps", () => {
    expect(trendLine([2, null, 0, 4])).toEqual([2, 2.7, 3.3, 4]);
    expect(trendLine([1])).toBeNull();
  });

  it("starts the axis at zero only when locked to it", () => {
    expect(chartBaseline([80.2, 81.4, 82], true)).toBe(0);
    expect(chartBaseline([80.2, 81.4, 82], false)).toBe(79);
    expect(chartBaseline([2000, 2600], false)).toBe(1800);
    expect(chartBaseline([0.5, 3], false)).toBe(0);
    expect(chartBaseline([], false)).toBe(0);
  });

  it("compares the last 7 logged days with the 7 before", () => {
    const days = (vals: number[]) =>
      vals.map((val, i) => ({ date: `${i}`, val }));
    expect(
      weeklyTrend(
        days([...Array<number>(7).fill(100), ...Array<number>(7).fill(110)]),
      ),
    ).toBe(10);
    expect(weeklyTrend(days(Array<number>(13).fill(1)))).toBeNull();
  });

  it("tallies completed days (#207)", () => {
    const stats = completionStats(["a", "b", "c", "d"], {
      a: { date: "a", completed_at: "x" },
      c: { date: "c", completed_at: "y" },
      d: { date: "d", completed_at: null },
    });
    expect(stats?.marked).toBe(2);
    expect(stats?.pct).toBe(50);
    expect(stats?.dates.has("c")).toBe(true);
  });

  it("groups history by month, newest first", () => {
    const groups = groupByMonth([
      { date: "2026-01-02", val: 1 },
      { date: "2026-02-01", val: 2 },
      { date: "2026-02-03", val: null },
      { date: "2026-02-05", val: 3 },
    ]);
    expect(groups.map((g) => [g.key, g.count])).toEqual([
      ["2026-02", 2],
      ["2026-01", 1],
    ]);
    expect(groups[0].entries[0].date).toBe("2026-02-05");
  });

  it("suggests other metrics on an empty chart", () => {
    const metrics = availableMetrics(LIST);
    expect(emptyAlternatives("calories", metrics)).toEqual(["weight"]);
  });

  it("exports logged days as CSV", () => {
    expect(toCsv(rows)).toBe("Date,Value\na,1\nc,0\nd,5");
  });
});

describe("nutrition and body stats", () => {
  it("multiplies by servings and derives salt from sodium", () => {
    const totals = calculateItem({
      quantity: 2,
      nutrition: { sodium: 400, _derived: {} },
    });
    expect(totals).toEqual({ sodium: 800, salt: 2 });
  });

  it("sums split recipes from their children", () => {
    const totals = calculateItem({
      quantity: 5,
      nutrition: { calories: 999 },
      _splitItems: [
        { quantity: 1, nutrition: { calories: 100 } },
        { quantity: 2, nutrition: { calories: 50 } },
      ],
    });
    expect(totals.calories).toBe(200);
  });

  it("reads flat legacy items and the calories_kcal alias", () => {
    expect(
      calculateItem({ quantity: 1, calories_kcal: 80, proteins: "3" }),
    ).toEqual({
      calories: 80,
      proteins: 3,
    });
    expect(sumNutrition([{ a: 1 }, null, { a: 2, b: 1 }])).toEqual({
      a: 3,
      b: 1,
    });
  });

  it("converts stored units and leaves unitless rows alone", () => {
    expect(
      readBodyStat({ weight: 100, weight_unit: "kg" }, "weight", "lb", "in"),
    ).toBe(220.5);
    expect(readBodyStat({ weight: 100 }, "weight", "lb", "in")).toBe(100);
    expect(readBodyStat({ body_fat: "20" }, "body_fat", "kg", "cm")).toBe(20);
    expect(readBodyStat({ neck: "" }, "neck", "kg", "cm")).toBeNull();
  });

  it("orders body stats by the user's order", () => {
    expect(orderBodyStats(["waist", "bogus"]).slice(0, 2)).toEqual([
      "waist",
      "weight",
    ]);
  });
});
