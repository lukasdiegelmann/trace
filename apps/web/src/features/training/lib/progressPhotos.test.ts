import { describe, expect, it } from "vitest";

import {
  axisPositions,
  comparePair,
  daysSinceFirst,
  groupByMonth,
  isHeic,
  nearestIndex,
  photoSrc,
  weightDelta,
  weightOfStats,
} from "./progressPhotos";

const photo = (
  id: number,
  date: string,
  url = "/uploads/body-stats/a.jpg",
) => ({
  id,
  date,
  url,
});

describe("progress photos", () => {
  it("reads stored photos through the owner-only route", () => {
    expect(photoSrc(photo(4, "2026-01-01"))).toBe(
      "/lt/api/body-stats/photos/4/file",
    );
    expect(photoSrc(photo(5, "2026-01-01", "https://x/y.jpg"))).toBe(
      "https://x/y.jpg",
    );
  });

  it("recognizes HEIC by name or type", () => {
    expect(isHeic({ name: "IMG.HEIC" })).toBe(true);
    expect(isHeic({ name: "a", type: "image/heif" })).toBe(true);
    expect(isHeic({ name: "a.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("groups newest-first photos by month", () => {
    const groups = groupByMonth([
      photo(3, "2026-02-10"),
      photo(2, "2026-02-01"),
      photo(1, "2026-01-01"),
    ]);
    expect(groups.map((g) => [g.month, g.photos.map((p) => p.id)])).toEqual([
      ["2026-02", [3, 2]],
      ["2026-01", [1]],
    ]);
  });

  it("puts the older photo first in a comparison", () => {
    const pair = comparePair(photo(2, "2026-02-01"), photo(1, "2026-01-01"));
    expect([pair.before.id, pair.after.id]).toEqual([1, 2]);
  });

  it("places photos on a real date axis, evenly on one date", () => {
    const ordered = [
      photo(1, "2026-01-01"),
      photo(2, "2026-01-11"),
      photo(3, "2026-04-11"),
    ];
    expect(axisPositions(ordered)).toEqual([0, 10, 100]);
    expect(nearestIndex([0, 10, 100], 40)).toBe(1);
    expect(nearestIndex([0, 10, 100], 80)).toBe(2);
    expect(axisPositions([photo(1, "2026-01-01")])).toEqual([50]);
    expect(
      axisPositions([photo(1, "2026-01-01"), photo(2, "2026-01-01")]),
    ).toEqual([0, 100]);
    expect(daysSinceFirst(ordered, 0)).toBeNull();
    expect(daysSinceFirst(ordered, 1)).toBe(10);
  });

  it("measures the change from the first weighed photo", () => {
    const ordered = [
      photo(1, "2026-01-01"),
      photo(2, "2026-02-01"),
      photo(3, "2026-03-01"),
    ];
    const weights: Record<string, number> = {
      "2026-02-01": 82,
      "2026-03-01": 80.25,
    };
    const weightOf = (date: string) => weights[date] ?? null;
    expect(weightDelta(ordered, 2, weightOf)).toEqual({
      delta: -1.7,
      since: "2026-02-01",
    });
    expect(weightDelta(ordered, 1, weightOf)).toBeNull();
    expect(weightDelta(ordered, 0, weightOf)).toBeNull();
  });

  it("reads a weight only when there is one", () => {
    expect(weightOfStats({ weight: "80.5" })).toBe(80.5);
    expect(weightOfStats({ weight: "" })).toBeNull();
    expect(weightOfStats({ weight: null })).toBeNull();
    expect(weightOfStats(undefined)).toBeNull();
  });
});
