import { describe, expect, it } from "vitest";

import type { FoodRow } from "../api";
import {
  addAltUnitRow,
  altUnitsFromRows,
  applyOffPrepared,
  applyOffRefresh,
  caloriesInputValue,
  emptyFoodForm,
  findDuplicateBarcode,
  foodFormFromExternal,
  foodFormFromRow,
  foodFormToWrite,
  isFoodFormBlank,
  removeAltUnitRow,
  scaleToPortion,
  setCaloriesInput,
  setFoodNutrient,
  shouldShowUnitMetadata,
  shouldStartLinked,
  takeScaleSnapshot,
  toggleNutritionBasis,
  updateAltUnitRow,
  validateFoodForm,
  type FoodFormState,
  type OffValues,
} from "./foodForm";
import samples from "./sources/fixtures/off-prepared-samples.json";
import beans from "./sources/fixtures/off-241-prepared-only.json";
import { mapOffProduct } from "./sources/openFoodFacts";

const ROW: FoodRow = {
  id: 7,
  user_id: 1,
  name: "Bread",
  brand: "Baker",
  nutrition: { calories: 250.123456, salt: 1, sodium: 400 },
  portion: 100,
  unit: "g",
  img_url: "/uploads/a.jpg",
  notes: "n",
  category: "Bakery",
  barcode: "4000",
  created_at: "",
  visibility: "private",
  source_id: null,
  source_app: null,
  source_external_id: null,
  source_url: null,
  updated_at: null,
  deleted_at: null,
  favorite: 1,
  usage_count: 0,
  last_used_at: null,
  nutrition_basis: "g",
  alt_units: [{ abbr: "slice", grams: 35 }],
  density_g_ml: null,
};

describe("form state", () => {
  it("round-trips a row without losing precision", () => {
    const write = foodFormToWrite(foodFormFromRow(ROW));
    expect(write).toEqual({
      name: "Bread",
      brand: "Baker",
      nutrition: { calories: 250.123456, salt: 1, sodium: 400 },
      portion: 100,
      unit: "g",
      img_url: "/uploads/a.jpg",
      notes: "n",
      category: "Bakery",
      barcode: "4000",
      nutrition_basis: "g",
      alt_units: [{ abbr: "slice", grams: 35 }],
      density_g_ml: null,
      favorite: true,
    });
  });

  it("sends cleared texts as empty strings", () => {
    const write = foodFormToWrite({
      ...foodFormFromRow(ROW),
      brand: "",
      notes: "",
      categories: [],
      barcode: " ",
      imgUrl: "",
    });
    expect(write).toMatchObject({
      brand: "",
      notes: "",
      category: "",
      barcode: "",
      img_url: null,
    });
  });

  it("keeps custom nutrients and derived flags, drops blanks", () => {
    const form = emptyFoodForm({
      name: "x",
      portion: "1,5",
      nutrients: { fat: "2,5", proteins: "", fiber: "abc", q10: "3", old: "1" },
      derived: { salt: false, sodium: true },
      sourceApp: "cooktrace",
    });
    const write = foodFormToWrite(form, [
      { id: "q10", label: "Q10", unit: "mg" },
    ]);
    expect(write.nutrition).toEqual({
      fat: 2.5,
      q10: 3,
      _derived: { sodium: true },
    });
    expect(write.portion).toBe(1.5);
    expect(write.source_app).toBe("cooktrace");
    expect(write).not.toHaveProperty("favorite");
  });

  it("blanks the stand-in zeros of a product without values", () => {
    const food = mapOffProduct(samples.products.drink, {}, true);
    if (!food) throw new Error("unmapped");
    const form = foodFormFromExternal(food);
    expect(form.nutrients.calories).toBe("");
    expect(shouldStartLinked(form)).toBe(false);
  });

  it("validates and knows a blank form", () => {
    expect(validateFoodForm(emptyFoodForm({ name: " " }))).toEqual([
      "nameRequired",
    ]);
    expect(isFoodFormBlank(emptyFoodForm({ barcode: "1" }))).toBe(true);
    expect(isFoodFormBlank(foodFormFromRow(ROW))).toBe(false);
  });

  it("finds a duplicate barcode other than the food itself", () => {
    const foods = [
      { id: 7, barcode: "4000" },
      { id: 8, barcode: "004000" },
    ];
    expect(findDuplicateBarcode(foods, foodFormFromRow(ROW))?.id).toBe(8);
    expect(findDuplicateBarcode(foods, emptyFoodForm())).toBeNull();
  });

  it("edits serving units and the basis", () => {
    let form = addAltUnitRow(emptyFoodForm());
    expect(shouldShowUnitMetadata(emptyFoodForm(), {})).toBe(false);
    expect(shouldShowUnitMetadata(form, {})).toBe(true);
    form = updateAltUnitRow(form, 0, { abbr: " cup ", grams: "2,5" });
    form = addAltUnitRow(form);
    expect(altUnitsFromRows(form.altUnits)).toEqual([
      { abbr: "cup", grams: 2.5 },
    ]);
    expect(altUnitsFromRows(removeAltUnitRow(form, 0).altUnits)).toBeNull();
    expect(toggleNutritionBasis(form, "ml").nutritionBasis).toBe("ml");
    expect(
      toggleNutritionBasis(toggleNutritionBasis(form, "ml"), "ml")
        .nutritionBasis,
    ).toBeNull();
  });
});

describe("typing", () => {
  it("lets the last of sodium and salt win", () => {
    let form = setFoodNutrient(emptyFoodForm(), "salt", "1,2");
    expect(form.nutrients.sodium).toBe("480");
    expect(form.derived).toEqual({ salt: false, sodium: true });
    form = setFoodNutrient(form, "sodium", "1000");
    expect(form.nutrients.salt).toBe("2.5");
    expect(form.derived).toEqual({ salt: true, sodium: false });
    form = setFoodNutrient(form, "sodium", "");
    expect(form.nutrients.salt).toBe("2.5");
  });

  it("stores typed kJ as kcal", () => {
    const form = setCaloriesInput(emptyFoodForm(), "1000", "kJ");
    expect(Number(form.nutrients.calories)).toBeCloseTo(239.0057, 3);
    expect(caloriesInputValue(form, "kJ")).toBe("1000");
    expect(caloriesInputValue(emptyFoodForm(), "kJ")).toBe("");
    expect(setCaloriesInput(form, "", "kJ").nutrients.calories).toBe("");
    expect(setCaloriesInput(form, "5", "kcal").nutrients.calories).toBe("5");
  });

  it("scales from the snapshot when the portion changes", () => {
    const form = emptyFoodForm({
      nutrients: { calories: "100", fat: "0", proteins: "3.3333" },
    });
    const snapshot = takeScaleSnapshot(form);
    const scaled = scaleToPortion({ ...form, portion: "150" }, snapshot);
    expect(scaled.nutrients).toEqual({
      calories: "150",
      fat: "0",
      proteins: "5",
    });
    expect(
      scaleToPortion({ ...scaled, portion: "100" }, snapshot).nutrients
        .calories,
    ).toBe("100");
    expect(scaleToPortion({ ...form, portion: "" }, snapshot).nutrients).toBe(
      form.nutrients,
    );
  });
});

// Upstream off-refresh.test.js
function off(
  nutrition: Record<string, number>,
  extra: Partial<OffValues> = {},
): OffValues {
  return {
    name: "Kidney beans",
    brand: "Rema 1000",
    imgUrl: "https://img/x.jpg",
    portion: 100,
    unit: "g",
    nutrition,
    derived: {},
    present: Object.keys(nutrition),
    isPreparedOnly: false,
    ...extra,
  };
}
const saved = (extra: Partial<FoodFormState> = {}) =>
  emptyFoodForm({
    name: "Kidney beans",
    brand: "Rema 1000",
    nutrients: { calories: "120", proteins: "7", fat: "0.5", fiber: "6" },
    ...extra,
  });

describe("applyOffRefresh", () => {
  it("changes what changed on OFF", () => {
    const result = applyOffRefresh(
      saved(),
      off({ calories: 101, proteins: 8.2, fat: 0.7, fiber: 6 }),
    );
    expect(result).toMatchObject({ reason: "updated", changed: 3 });
    expect(result.form.nutrients).toMatchObject({
      calories: "101",
      proteins: "8.2",
      fat: "0.7",
    });
  });

  it("never zeroes a value OFF lacks, but takes a real zero", () => {
    const { form } = applyOffRefresh(
      saved(),
      off({ calories: 101, fiber: 0 }, { present: ["calories"] }),
    );
    expect(form.nutrients.fiber).toBe("6");
    expect(applyOffRefresh(saved(), off({ fat: 0 })).form.nutrients.fat).toBe(
      "0",
    );
  });

  it("says up to date whatever the number format", () => {
    const form = saved({
      nutrients: { calories: "120", proteins: "7,0", fat: "0.5" },
    });
    expect(
      applyOffRefresh(form, off({ calories: 120, proteins: 7, fat: 0.5 })),
    ).toMatchObject({ reason: "upToDate", changed: 0 });
  });

  it.each([
    ["50", "g", 101, "50.5"],
    ["250", "ml", 40, "100"],
    ["1", "oz", 100, "28.35"],
    ["1,5", "kg", 100, "1500"],
  ])("converts to a portion of %s %s", (portion, unit, kcal, expected) => {
    expect(
      applyOffRefresh(saved({ portion, unit }), off({ calories: kcal })).form
        .nutrients.calories,
    ).toBe(expected);
  });

  it("changes nothing across unconvertible units", () => {
    const result = applyOffRefresh(
      saved({ portion: "1", unit: "slice" }),
      off({ calories: 101 }),
    );
    expect(result.reason).toBe("unitsDiffer");
    expect(result.form.nutrients.calories).toBe("120");
    expect(
      applyOffRefresh(
        saved({ portion: "1", unit: "bar" }),
        off({ calories: 210 }, { portion: 1, unit: "bar" }),
      ).form.nutrients.calories,
    ).toBe("210");
  });

  it("says why there is nothing", () => {
    const prepared = applyOffRefresh(
      saved(),
      off({ calories: 0 }, { present: [], isPreparedOnly: true }),
    );
    expect(prepared.reason).toBe("preparedOnly");
    expect(prepared.form.nutrients).toEqual(saved().nutrients);
    expect(applyOffRefresh(saved(), off({}, { present: [] })).reason).toBe(
      "noNutrition",
    );
  });

  it("only fills an empty name, brand and photo, and a missing portion", () => {
    const { form } = applyOffRefresh(
      saved({ name: "Beans for chili" }),
      off({ calories: 101 }),
    );
    expect(form.name).toBe("Beans for chili");
    expect(form.imgUrl).toBe("https://img/x.jpg");
    const bare = applyOffRefresh(
      emptyFoodForm({ portion: "", unit: "" }),
      off({ calories: 101 }),
    ).form;
    expect([bare.portion, bare.unit, bare.nutrients.calories]).toEqual([
      "100",
      "g",
      "101",
    ]);
  });

  it("does not modify its input", () => {
    const form = saved();
    const before = JSON.stringify(form);
    applyOffRefresh(form, off({ calories: 99 }));
    expect(JSON.stringify(form)).toBe(before);
  });

  it("follows OFF's salt and sodium marks", () => {
    const saltOnly = off(
      { salt: 1, sodium: 400 },
      { derived: { sodium: true } },
    );
    expect(applyOffRefresh(saved(), saltOnly).form.derived).toEqual({
      salt: false,
      sodium: true,
    });
    const both = off({ salt: 1, sodium: 400 });
    expect(
      applyOffRefresh(saved({ derived: { salt: true } }), both).form.derived,
    ).toEqual({ salt: false, sodium: false });
    expect(
      applyOffRefresh(saved({ derived: { salt: true } }), off({ calories: 9 }))
        .form.derived,
    ).toEqual({ salt: true });
  });
});

describe("applyOffPrepared", () => {
  it("converts to the portion and notes it once", () => {
    const food = mapOffProduct(beans.product, {}, true);
    const note = 'Values are "as prepared".';
    const form = emptyFoodForm({
      name: "Kidney beans",
      portion: "252",
      nutrients: { calories: "0" },
      notes: "Organic",
    });
    const result = applyOffPrepared(form, food?.offInfo ?? null, note);
    expect(result.reason).toBe("updated");
    expect(Number(result.form.nutrients.calories)).toBeCloseTo(101 * 2.52, 2);
    expect(result.form.notes).toBe(`Organic\n${note}`);
    expect(
      applyOffPrepared(result.form, food?.offInfo ?? null, note).form.notes,
    ).toBe(`Organic\n${note}`);
    expect(form.nutrients.calories).toBe("0");
  });
});
