import { describe, expect, it } from "vitest";

import {
  addDays,
  formatDateSetting,
  formatTimeSetting,
  isIsoDate,
  localDateStr,
  parseIsoDate,
  parseServerTimestamp,
  weekOf,
} from "./dates";

describe("calendar dates", () => {
  it("reads and writes the local day", () => {
    expect(localDateStr(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(parseIsoDate("2026-01-05").getHours()).toBe(12);
  });

  it("accepts only complete ISO dates", () => {
    expect(isIsoDate("2026-03-29")).toBe(true);
    expect(isIsoDate("2026-3-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("steps over months, years and clock changes", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("lists the week from Sunday to Saturday", () => {
    const week = weekOf("2026-11-26");
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-11-22");
    expect(week[6]).toBe("2026-11-28");
    expect(weekOf("2026-11-22")[0]).toBe("2026-11-22");
  });

  it("formats as the settings ask", () => {
    expect(formatDateSetting("2026-11-26", "ISO", "en")).toBe("2026-11-26");
    expect(formatDateSetting("2026-11-26", "US", "en")).toBe("11/26/2026");
    expect(formatDateSetting("2026-11-26", "EU", "en")).toBe("26.11.2026");
    expect(formatDateSetting("2026-11-26", "natural", "en-US")).toBe(
      "November 26, 2026",
    );
    const evening = new Date(2026, 10, 26, 18, 5);
    expect(formatTimeSetting(evening, "24h", "en-GB")).toBe("18:05");
    expect(formatTimeSetting(evening, "12h", "en-US")).toMatch(/^6:05\sPM$/);
  });

  it("reads the server's UTC timestamps", () => {
    expect(parseServerTimestamp("2026-11-26 08:30:00").toISOString()).toBe(
      "2026-11-26T08:30:00.000Z",
    );
    expect(parseServerTimestamp("2026-11-26T08:30:00Z").getUTCHours()).toBe(8);
  });
});
