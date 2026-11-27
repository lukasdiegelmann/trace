import "@testing-library/jest-dom/vitest";
import "@/i18n";

import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Rendering whole routes (lazy chunks included) takes more than the default
// second on a loaded machine; a wait that succeeds costs nothing extra.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

// jsdom has no matchMedia; monolithium's hooks and the theme read it.
if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// Inert stand-ins for what jsdom lacks and monolithium's components reach
// for on mount (as in monolithium's own vitest.setup.ts). No layout stands
// behind them: tests assert structure and text, never sizes.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver = class {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

if (!(Element.prototype as Partial<Element>).scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
