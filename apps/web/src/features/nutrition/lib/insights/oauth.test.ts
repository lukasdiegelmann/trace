import { describe, expect, it } from "vitest";

import { oauthResult, suggestedRedirectUri } from "./oauth";

describe("oauth return", () => {
  it("reads the provider's result from the query", () => {
    expect(oauthResult(new URLSearchParams("google_health=connected"))).toEqual(
      {
        providerName: "Fitbit",
        isConnected: true,
        message: null,
      },
    );
    expect(
      oauthResult(new URLSearchParams("withings=error&msg=state_mismatch")),
    ).toEqual({
      providerName: "Withings",
      isConnected: false,
      message: "state_mismatch",
    });
    expect(oauthResult(new URLSearchParams("date=2026-01-01"))).toBeNull();
  });

  it("suggests the callback under /nt", () => {
    expect(suggestedRedirectUri("https://trace.example", "garmin")).toBe(
      "https://trace.example/nt/api/wellness/garmin/callback",
    );
  });
});
