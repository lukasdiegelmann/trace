import { describe, expect, it } from "vitest";

import { domainFromUrl, formatDate, formatUpdated } from "./dates";
import { formatDuration, totalMinutes } from "./duration";

describe("durations", () => {
  it("formats minutes", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(135)).toBe("2h 15m");
  });

  it("prefers the typed total, even 0", () => {
    expect(totalMinutes({ prep_minutes: 10, cook_minutes: 5 })).toBe(15);
    expect(totalMinutes({ total_minutes: 0, prep_minutes: 10 })).toBe(0);
  });
});

describe("dates", () => {
  it("follows the dateFormat setting", () => {
    const input = "2026-05-04T12:00:00Z";
    expect(formatDate(input, "ISO", "en")).toBe("2026-05-04");
    expect(formatDate(input, "US", "en")).toBe("05/04/2026");
    expect(formatDate(input, "EU", "en")).toBe("04/05/2026");
    expect(formatDate(input, "natural", "en")).toBe("May 4, 2026");
    expect(formatDate("nonsense", "ISO", "en")).toBe("");
  });

  it("is relative for a week", () => {
    const now = Date.parse("2026-05-10T12:00:00Z");
    expect(formatUpdated("2026-05-09 12:00:00", "ISO", "en", now)).toBe(
      "yesterday",
    );
    expect(formatUpdated("2026-04-01 12:00:00", "ISO", "en", now)).toBe(
      "2026-04-01",
    );
  });

  it("takes the domain of web links only", () => {
    expect(domainFromUrl("https://www.example.com/a")).toBe("example.com");
    expect(domainFromUrl("javascript:alert(1)")).toBe("");
    expect(domainFromUrl("no url")).toBe("");
  });
});
