import { describe, expect, it } from "vitest";

import { emptyFoodForm } from "./foodForm";
import { applyLabel } from "./labelScan";

describe("applyLabel", () => {
  const form = emptyFoodForm({
    name: "Old",
    brand: "Kept",
    nutrients: { calories: "100", fat: "3", sodium: "400", salt: "1" },
    derived: { salt: true },
  });

  it("overwrites what the label shows and keeps the rest", () => {
    expect(
      applyLabel(form, {
        name: " Muesli ",
        portion: 45,
        unit: "g",
        calories: "170",
        proteins: 5,
        made_up: 1,
        fiber: "n/a",
      }),
    ).toMatchObject({
      name: "Muesli",
      brand: "Kept",
      portion: "45",
      nutrients: { calories: "170", fat: "3", proteins: "5" },
    });
  });

  it("works out sodium from salt alone", () => {
    expect(applyLabel(form, { salt: 0.5 })).toMatchObject({
      nutrients: { salt: "0.5", sodium: "200" },
      derived: { salt: false, sodium: true },
    });
  });

  it("keeps both when the label has both", () => {
    expect(applyLabel(form, { salt: 0.5, sodium: 210 })).toMatchObject({
      nutrients: { salt: "0.5", sodium: "210" },
      derived: { salt: false, sodium: false },
    });
  });
});
