import { describe, expect, it } from "vitest";

import {
  readThemePreference,
  resolveIsDark,
  setThemePreference,
  THEME_STORAGE_KEY,
} from "./theme";

describe("theme", () => {
  it("resolves system, light and dark", () => {
    expect(resolveIsDark("system", true)).toBe(true);
    expect(resolveIsDark("system", false)).toBe(false);
    expect(resolveIsDark("light", true)).toBe(false);
    expect(resolveIsDark("dark", false)).toBe(true);
  });

  it("stores a manual choice and switches the dark class", () => {
    setThemePreference("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(readThemePreference()).toBe("dark");

    setThemePreference("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
