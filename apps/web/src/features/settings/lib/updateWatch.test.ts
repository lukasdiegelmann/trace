import { describe, expect, it } from "vitest";

import { isUpdateCheckDue } from "./updateWatch";

const HOUR_MS = 60 * 60 * 1000;

describe("isUpdateCheckDue", () => {
  it("is due once the interval has passed", () => {
    expect(isUpdateCheckDue(4, 0, 4 * HOUR_MS)).toBe(true);
    expect(isUpdateCheckDue(4, 0, 4 * HOUR_MS - 1)).toBe(false);
  });

  it("is never due when checks are by hand only", () => {
    expect(isUpdateCheckDue(0, 0, 100 * HOUR_MS)).toBe(false);
    expect(isUpdateCheckDue(undefined, 0, 100 * HOUR_MS)).toBe(false);
  });
});
