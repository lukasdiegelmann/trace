import { describe, expect, it } from "vitest";

import { assetUrl } from "./assetUrl";
import { parseSmartFilter } from "./smartCookbook";

describe("assetUrl", () => {
  it("serves the backend's uploads under /ct", () => {
    expect(assetUrl("/uploads/a.jpg")).toBe("/ct/uploads/a.jpg");
    expect(assetUrl("uploads/a.jpg")).toBe("/ct/uploads/a.jpg");
    expect(assetUrl("https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg",
    );
  });

  it("drops script and protocol-relative URLs", () => {
    expect(assetUrl("javascript:alert(1)")).toBe("");
    expect(assetUrl("//evil.example/a")).toBe("");
    expect(assetUrl(null)).toBe("");
  });
});

describe("parseSmartFilter", () => {
  it("reads a JSON string or an object, else null", () => {
    expect(parseSmartFilter('{"tags":["a"]}')).toEqual({ tags: ["a"] });
    expect(parseSmartFilter({ favorites_only: true })).toEqual({
      favorites_only: true,
    });
    expect(parseSmartFilter("{")).toBeNull();
    expect(parseSmartFilter("")).toBeNull();
  });
});
