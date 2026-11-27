import { describe, expect, it } from "vitest";

import { offCountryTagToFlag, offCountryTagToName } from "./offCountries";

describe("OFF country tags", () => {
  it("gives flags and names", () => {
    expect(offCountryTagToFlag("en:france")).toBe("🇫🇷");
    expect(offCountryTagToFlag("Germany")).toBe("🇩🇪");
    expect(offCountryTagToFlag("en:atlantis")).toBe("");
    expect(offCountryTagToFlag(null)).toBe("");
    expect(offCountryTagToName("en:new-zealand")).toBe("New Zealand");
  });
});
