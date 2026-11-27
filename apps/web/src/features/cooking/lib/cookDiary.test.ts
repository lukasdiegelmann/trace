import { describe, expect, it } from "vitest";

import {
  diaryRange,
  entryPhotos,
  filterEntries,
  groupByDate,
  heatLevel,
  heatmapTotals,
  heatmapWeeks,
  monthCells,
  photoTiles,
} from "./cookDiary";
import { cookEntry } from "./testRows";

const entries = [
  cookEntry({ id: 1, date: "2026-05-10", meal_type: "lunch" }),
  cookEntry({
    id: 2,
    date: "2026-05-20",
    kind: "planned",
    recipe_id: 2,
    recipe_name: "Crème brûlée",
  }),
  cookEntry({ id: 3, date: "2026-05-14", notes: "salty" }),
  cookEntry({ id: 4, date: "2026-05-01", cooked_by_username: "alex" }),
];

describe("cook diary", () => {
  it("reads multi and single photos", () => {
    expect(entryPhotos({ photos: '["a","b"]', photo_url: "c" })).toEqual([
      "a",
      "b",
    ]);
    expect(entryPhotos({ photos: "[]", photo_url: "c" })).toEqual(["c"]);
    expect(entryPhotos({ photos: "broken", photo_url: null })).toEqual([]);
  });

  it("filters by recipe, meal and folded text", () => {
    const none = { recipeId: null, meal: null, query: "" };
    const ids = (filter: Partial<typeof none> | object) =>
      filterEntries(entries, { ...none, ...filter }).map((e) => e.id);
    expect(ids({ recipeId: 2 })).toEqual([2]);
    expect(ids({ meal: "lunch" })).toEqual([1]);
    expect(ids({ query: "creme" })).toEqual([2]);
    expect(ids({ query: "SALT" })).toEqual([3]);
    expect(ids({ query: "alex" })).toEqual([4]);
  });

  it("puts today and the future first, latest first in each block", () => {
    expect(
      groupByDate(entries, "2026-05-14").map((day) => [
        day.date,
        day.isUpcoming,
      ]),
    ).toEqual([
      ["2026-05-20", true],
      ["2026-05-14", true],
      ["2026-05-10", false],
      ["2026-05-01", false],
    ]);
  });

  it("makes one tile per photo, newest first", () => {
    expect(
      photoTiles([
        cookEntry({ id: 1, date: "2026-05-01", photo_url: "old" }),
        cookEntry({ id: 2, date: "2026-05-09", photos: ["x", "y"] }),
      ]).map((tile) => [tile.url, tile.index, tile.count]),
    ).toEqual([
      ["x", 0, 2],
      ["y", 1, 2],
      ["old", 0, 1],
    ]);
  });

  it("builds 42 month cells from the week's first day", () => {
    const may = new Date(2026, 4, 1);
    const sunday = monthCells(may, entries, "2026-05-14", 0);
    expect(sunday).toHaveLength(42);
    expect(sunday[0]?.date).toBe("2026-04-26");
    expect(monthCells(may, entries, "2026-05-14", 1)[0]?.date).toBe(
      "2026-04-27",
    );
    expect(sunday.find((cell) => cell.isToday)?.entries).toHaveLength(1);
  });

  it("asks for the month around, or everything up to 30 days ahead", () => {
    const today = new Date(2026, 4, 14);
    expect(diaryRange("month", new Date(2026, 4, 1), today)).toEqual({
      from: "2026-04-01",
      to: "2026-06-30",
    });
    expect(diaryRange("list", today, today)).toEqual({
      from: "1970-01-01",
      to: "2026-06-13",
    });
  });

  it("builds the heatmap of 53 weeks ending today", () => {
    const today = new Date(2026, 4, 14);
    const data = [{ date: "2026-05-13", count: 3 }];
    const weeks = heatmapWeeks(data, today);
    expect(weeks).toHaveLength(53);
    const last = weeks.at(-1)?.days;
    expect(last?.[3]).toEqual({
      date: "2026-05-13",
      count: 3,
      isFuture: false,
    });
    expect(last?.[5]?.isFuture).toBe(true);
    expect(weeks.filter((week) => week.monthStart).length).toBeGreaterThan(11);
    expect([0, 1, 2, 3, 4, 9].map(heatLevel)).toEqual([0, 1, 2, 3, 3, 4]);
    expect(heatmapTotals(data)).toEqual({ total: 3, activeDays: 1 });
  });
});
