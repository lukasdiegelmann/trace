import { describe, expect, it, vi } from "vitest";

import { claimDaily, claimRecord, notify } from "./celebrations";

describe("celebrations", () => {
  it("celebrates once a day", () => {
    expect(claimDaily("workout", "2026-11-26")).toBe(true);
    expect(claimDaily("workout", "2026-11-26")).toBe(false);
    expect(claimDaily("workout", "2026-11-27")).toBe(true);
  });

  it("celebrates a record only when it beats today's", () => {
    expect(claimRecord("pr", "Bench", 100)).toBe(true);
    expect(claimRecord("pr", "Bench", 100)).toBe(false);
    expect(claimRecord("pr", "Bench", 102.5)).toBe(true);
    expect(claimRecord("prHold", "Bench", 30)).toBe(true);
  });

  it("pushes only when a service is configured", async () => {
    const push = vi.fn(() => Promise.resolve());
    await notify("a", "b", { hasLocal: false, pushService: "none" }, push);
    expect(push).not.toHaveBeenCalled();
    await notify("a", "b", { hasLocal: false, pushService: "ntfy" }, push);
    expect(push).toHaveBeenCalledWith("a", "b");
  });
});
