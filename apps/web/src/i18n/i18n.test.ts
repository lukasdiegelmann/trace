import { describe, expect, it } from "vitest";

import { detectLanguage } from "./index";
import { resources } from "./resources";

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("translations", () => {
  it.each(Object.keys(resources.en))(
    "namespace %s has the same keys in de and en",
    (ns) => {
      const en = keysOf(resources.en[ns as keyof typeof resources.en]).sort();
      const de = keysOf(resources.de[ns as keyof typeof resources.de]).sort();
      expect(de).toEqual(en);
    },
  );

  it("has no empty strings", () => {
    for (const language of Object.values(resources)) {
      for (const namespace of Object.values(language)) {
        expect(JSON.stringify(namespace)).not.toContain('""');
      }
    }
  });
});

describe("detectLanguage", () => {
  it("prefers the stored choice, then the browser, then German", () => {
    expect(detectLanguage("en", ["de-DE"])).toBe("en");
    expect(detectLanguage(null, ["fr-FR", "en-US"])).toBe("en");
    expect(detectLanguage("xx", ["fr"])).toBe("de");
  });
});
