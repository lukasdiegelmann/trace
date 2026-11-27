/**
 * Where "/" leads on this device. The old apps kept a `startPage` each, with
 * paths of their own; Trace has one start page among its sections.
 */
export const START_PAGES = [
  "/nutrition",
  "/cooking",
  "/training",
  "/settings",
] as const;

export type StartPage = (typeof START_PAGES)[number];

export const START_PAGE_STORAGE_KEY = "trace.startPage";

export function readStartPage(): StartPage {
  try {
    const stored = window.localStorage.getItem(START_PAGE_STORAGE_KEY);
    return START_PAGES.find((page) => page === stored) ?? "/nutrition";
  } catch {
    return "/nutrition";
  }
}

export function setStartPage(page: StartPage): void {
  try {
    window.localStorage.setItem(START_PAGE_STORAGE_KEY, page);
  } catch {
    // Private mode: the default stays.
  }
}
