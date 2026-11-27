import { describe, expect, it } from "vitest";

import {
  buildOffContributionUrl,
  isOffUploadAccepted,
  offProductPageUrl,
} from "./offContribute";

const account = { username: "me", password: "p&w", country: "Auto" };

describe("buildOffContributionUrl", () => {
  it("sends per 100 g with sodium in grams", () => {
    const url = new URL(
      buildOffContributionUrl(
        {
          name: "Bread & Butter",
          barcode: "4000",
          portion: "100",
          unit: "g",
          nutrition: { calories: 250, sodium: 480, salt: "1,2", iron: 2 },
        },
        account,
        "de-DE",
      ) ?? "",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      code: "4000",
      user_id: "me",
      password: "p&w",
      lang: "de",
      product_name_de: "Bread & Butter",
      nutrition_data_per: "100g",
      "nutriment_energy-kcal": "250",
      nutriment_salt: "1.2",
      nutriment_sodium: "0.48",
    });
  });

  it("sends other portions per serving, with the country", () => {
    const url = new URL(
      buildOffContributionUrl(
        { name: "x", barcode: "1", brand: "b", portion: 35, unit: "g" },
        { ...account, country: "Germany" },
        "en",
      ) ?? "",
    );
    expect(url.searchParams.get("nutrition_data_per")).toBe("serving");
    expect(url.searchParams.get("serving_size")).toBe("35 g");
    expect(url.searchParams.get("countries")).toBe("Germany");
    expect(url.searchParams.get("brands")).toBe("b");
  });

  it("needs a name, a barcode and an account", () => {
    const food = { name: "x", barcode: "1" };
    expect(
      buildOffContributionUrl({ ...food, name: "" }, account, "en"),
    ).toBeNull();
    expect(
      buildOffContributionUrl(food, { username: "", password: "" }, "en"),
    ).toBeNull();
  });

  it("reads the answer and builds the page URL", () => {
    expect(isOffUploadAccepted({ status: 1 })).toBe(true);
    expect(isOffUploadAccepted({ status: 0 })).toBe(false);
    expect(offProductPageUrl("40 0")).toBe(
      "https://world.openfoodfacts.org/product/40%200",
    );
  });
});
