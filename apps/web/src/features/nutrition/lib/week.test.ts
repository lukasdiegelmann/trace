import { describe, expect, it } from "vitest";

import { addDays, weekOf } from "./dates";
import { weekStatus } from "./week";

describe("week strip", () => {
  it("shows Sunday to Saturday around a day", () => {
    expect(weekOf("2026-09-09")).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("classifies a day against its goal", () => {
    const today = "2026-09-09";
    expect(weekStatus("2026-09-10", today, 100, 2000)).toBe("future");
    expect(weekStatus(today, today, 0, 2000)).toBe("none");
    expect(weekStatus(today, today, 2201, 2000)).toBe("over");
    expect(weekStatus(today, today, 1799, 2000)).toBe("under");
    expect(weekStatus(today, today, 2200, 2000)).toBe("on");
    expect(weekStatus(today, today, 500, 0)).toBe("none");
  });
});
