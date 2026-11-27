/**
 * Dark mode, system or manual: the `dark` class on <html> switches
 * monolithium's tokens (tokens.css `.dark`). index.html applies the stored
 * choice before the first paint with the same key and rule.
 */
import { useSyncExternalStore } from "react";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const THEME_STORAGE_KEY = "trace.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function resolveIsDark(
  preference: ThemePreference,
  isSystemDark: boolean,
): boolean {
  return preference === "dark" || (preference === "system" && isSystemDark);
}

function systemIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(preference: ThemePreference): void {
  const isDark = resolveIsDark(preference, systemIsDark());
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

const listeners = new Set<() => void>();

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  current = preference;
  applyTheme(preference);
  for (const listener of listeners) listener();
}

let current: ThemePreference = "system";

/** Applies the stored choice and follows the system while it is "system" */
export function initTheme(): void {
  current = readThemePreference();
  applyTheme(current);
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (current === "system") applyTheme("system");
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => current);
}
