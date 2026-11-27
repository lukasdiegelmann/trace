import { describe, expect, it } from "vitest";

import { offProductName } from "./offName";

// Barcode 7623186629037 as OFF v3 returned it (upstream off-name.test.js)
const REPORTED = {
  lang: "fr",
  lc: "fr",
  product_name: "",
  product_name_de: "Milch Drink UHT 1,5% Milchfett",
  product_name_en: "Milch Drink UHT 1,5% Milchfett",
  product_name_fr: "",
  generic_name: "",
  generic_name_de: "Milch, teilentrahmt",
};

const TRANSLATED = {
  lang: "fr",
  product_name: "UHT Milch Drink",
  product_name_fr: "UHT Milch Drink",
  product_name_en: "UHT Milch Drink Teilentrahmt",
  product_name_de: "Bio Milch UHT",
};

describe("offProductName", () => {
  it("finds a name when product_name is blank", () => {
    for (const language of ["en", "de", "fr"]) {
      expect(offProductName(REPORTED, language)).toBe(
        "Milch Drink UHT 1,5% Milchfett",
      );
    }
  });

  it("keeps the name on the default language", () => {
    for (const language of ["en", undefined, ""]) {
      expect(offProductName(TRANSLATED, language)).toBe("UHT Milch Drink");
    }
  });

  it("prefers a language picked on purpose", () => {
    expect(offProductName(TRANSLATED, "de")).toBe("Bio Milch UHT");
    expect(offProductName(TRANSLATED, "it")).toBe("UHT Milch Drink");
  });

  it("goes chosen, main, English, then any other in a fixed order", () => {
    const product = {
      lang: "it",
      product_name: "",
      product_name_it: "Latte",
      product_name_en: "Milk",
      product_name_es: "Leche",
    };
    expect(offProductName(product, "es")).toBe("Leche");
    expect(offProductName(product, "en")).toBe("Milk");
    expect(offProductName(product, "de")).toBe("Latte");
    expect(offProductName({ ...product, product_name_it: "" }, "de")).toBe(
      "Milk",
    );
    expect(
      offProductName(
        { lang: "it", product_name_nl: "Melk", product_name_da: "Mælk" },
        "en",
      ),
    ).toBe("Mælk");
  });

  it("falls back to generic_name", () => {
    expect(
      offProductName(
        { lang: "fr", generic_name_de: "Milch, teilentrahmt" },
        "en",
      ),
    ).toBe("Milch, teilentrahmt");
    expect(
      offProductName({ generic_name: "Milk", generic_name_de: "Milch" }, "de"),
    ).toBe("Milch");
    expect(
      offProductName({ product_name_en: "Milk", generic_name: "Dairy" }, "en"),
    ).toBe("Milk");
  });

  it("ignores blank, non-text and look-alike fields", () => {
    expect(
      offProductName({ product_name: "   ", product_name_en: "Milk" }, "en"),
    ).toBe("Milk");
    expect(
      offProductName(
        {
          product_name: { en: "x" },
          product_name_de: ["x"],
          product_name_fr: 5,
          product_name_en: "Milk",
        },
        "en",
      ),
    ).toBe("Milk");
    for (const product of [{}, { generic_name: "  " }, null, undefined, "x"]) {
      expect(offProductName(product, "en")).toBe("");
    }
    expect(
      offProductName(
        { product_name_debug_tags: "x", product_name_en_imported: "y" },
        "en",
      ),
    ).toBe("");
  });
});
