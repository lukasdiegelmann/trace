import { describe, expect, it } from "vitest";

import { buildSubsonicParams, randomSalt } from "./radioSubsonic";

describe("buildSubsonicParams", () => {
  it("makes the token of the Subsonic docs' example", () => {
    const params = buildSubsonicParams(
      { user: "joe", password: "sesame" },
      { id: "7" },
      "c19b2d",
    );
    expect(Object.fromEntries(params)).toEqual({
      u: "joe",
      t: "26719a1196d2a940705a59634eb18eab",
      s: "c19b2d",
      v: "1.16.1",
      c: "LiftTrace",
      f: "json",
      id: "7",
    });
  });

  it("salts with 8 base-36 characters", () => {
    expect(randomSalt(() => 0)).toBe("00000000");
    expect(randomSalt()).toMatch(/^[0-9a-z]{8}$/);
  });
});
