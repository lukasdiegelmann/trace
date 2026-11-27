import { describe, expect, it } from "vitest";

import {
  isoDate,
  relativeParts,
  relativeTime,
  shortDate,
  toDate,
} from "./relativeTime";

const NOW = new Date(2026, 4, 14, 12, 0, 0).getTime();

describe("relativeTime", () => {
  it("parses date-only strings as local midnight", () => {
    const date = toDate("2026-05-14");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 4, 14,
    ]);
    expect(isoDate(date)).toBe("2026-05-14");
  });

  it("parses SQLite timestamps as UTC", () => {
    expect(toDate("2026-05-04 03:30:00").toISOString()).toBe(
      "2026-05-04T03:30:00.000Z",
    );
  });

  it("buckets like the original", () => {
    expect(relativeParts(NOW - 10_000, NOW)).toEqual({
      value: 0,
      unit: "second",
    });
    expect(relativeParts(NOW - 3 * 86400_000, NOW)).toEqual({
      value: -3,
      unit: "day",
    });
    expect(relativeParts(NOW + 30 * 3600_000, NOW)).toEqual({
      value: 1,
      unit: "day",
    });
    expect(relativeParts(NOW - 100 * 86400_000, NOW)).toEqual({
      value: -3,
      unit: "month",
    });
    expect(relativeParts(NOW - 800 * 86400_000, NOW)).toEqual({
      value: -2,
      unit: "year",
    });
  });

  it("speaks the UI language", () => {
    expect(relativeTime(NOW - 3 * 86400_000, "en", NOW)).toBe("3 days ago");
    expect(relativeTime(NOW - 30 * 3600_000, "de", NOW)).toBe("gestern");
    expect(relativeTime("", "en", NOW)).toBe("");
    expect(shortDate("2026-05-04", "en")).toBe("May 4, 2026");
    expect(shortDate("nonsense", "en")).toBe("");
  });
});
