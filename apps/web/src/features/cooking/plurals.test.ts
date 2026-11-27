/// <reference types="vite/client" />
/**
 * A plural key without `count` shows as the raw key; the type check can't
 * see it, so every call is looked up here.
 */
import { describe, expect, it } from "vitest";

import en from "./locales/en.json";

const sources = import.meta.glob<string>("./**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

function pluralKeys(node: object, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      return pluralKeys(value as object, path);
    }
    const base = /^(.*)_(?:one|other)$/.exec(path)?.[1];
    return base ? [base] : [];
  });
}

/** The arguments of the call that opens at `start` */
function argumentsAt(source: string, start: number): string {
  let depth = 0;
  for (let i = source.indexOf("(", start); i < source.length; i++) {
    if (source[i] === "(") depth++;
    if (source[i] === ")" && --depth === 0) return source.slice(start, i);
  }
  return "";
}

describe("plural strings", () => {
  it("are always asked for with a count", () => {
    const keys = [...new Set(pluralKeys(en))];
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      for (const key of keys) {
        const call = new RegExp(
          `\\bt\\(\\s*"${key.replace(/\./g, "\\.")}"`,
          "g",
        );
        for (const found of source.matchAll(call)) {
          if (!/\bcount\b/.test(argumentsAt(source, found.index))) {
            missing.push(`${file}: ${key}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
