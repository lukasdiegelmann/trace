/**
 * The FoodEditor's logic, ported from
 * nutritrace/src/routes/FoodEditor.svelte and lib/off-refresh.js. The form
 * holds what the inputs show: numbers as text, calories always in kcal.
 */
/* eslint-disable @typescript-eslint/naming-convention -- the backend's keys */
import type { FoodRow, FoodWrite, NutritionMap, Visibility } from "../api";
import { findByBarcode } from "./barcode";
import { parseDecimal, parsePositive } from "./decimal";
import { allNutrientIds } from "./nutrientFields";
import {
  KJ_PER_KCAL,
  NUTRIMENTS,
  SODIUM_MG_PER_SALT_G,
  type CustomNutrient,
  type EnergyUnit,
} from "./nutrition";
import { offNutritionStatus } from "./sources/offStatus";
import {
  derivedFlagsOf,
  withDerivedFlags,
  type DerivedFlags,
  type ExternalFood,
  type OffInfo,
} from "./sources/types";
import { parseAltUnits, unitToGrams, type AltUnit } from "./units";

export interface AltUnitRow {
  abbr: string;
  grams: string;
}

export interface FoodFormState {
  id: number | null;
  name: string;
  brand: string;
  barcode: string;
  /** The stored URL or a data: URL (show it through `assetUrl`) */
  imgUrl: string;
  portion: string;
  unit: string;
  /** Input text by nutrient id; missing or "" means no value */
  nutrients: Record<string, string>;
  derived: DerivedFlags;
  nutritionBasis: "g" | "ml" | null;
  altUnits: AltUnitRow[];
  density: string;
  /** Only the first one is stored */
  categories: string[];
  notes: string;
  isFavorite: boolean;
  visibility: Visibility | null;
  /** Set for another user's food: read only */
  sharedBy: string | null;
  sourceApp: string | null;
  sourceExternalId: string | null;
  sourceUrl: string | null;
}

/** A stored number as input text, without float noise and without rounding */
export function numberText(value: unknown): string {
  const number = parseDecimal(value);
  return Number.isFinite(number) ? String(Number(number.toPrecision(12))) : "";
}

export function emptyFoodForm(
  fields: Partial<FoodFormState> = {},
): FoodFormState {
  return {
    id: null,
    name: "",
    brand: "",
    barcode: "",
    imgUrl: "",
    portion: "100",
    unit: "g",
    nutrients: {},
    derived: {},
    nutritionBasis: null,
    altUnits: [],
    density: "",
    categories: [],
    notes: "",
    isFavorite: false,
    visibility: null,
    sharedBy: null,
    sourceApp: null,
    sourceExternalId: null,
    sourceUrl: null,
    ...fields,
  };
}

function nutrientTexts(
  nutrition: NutritionMap | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(nutrition ?? {})) {
    if (id === "_derived") continue;
    const text = numberText(value);
    if (text !== "") out[id] = text;
  }
  return out;
}

function altUnitRows(value: unknown): AltUnitRow[] {
  return (parseAltUnits(value) ?? []).map((row) => ({
    abbr: row.abbr,
    grams: numberText(row.grams),
  }));
}

export function foodFormFromRow(row: FoodRow): FoodFormState {
  return emptyFoodForm({
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    barcode: row.barcode ?? "",
    imgUrl: row.img_url ?? "",
    portion: numberText(row.portion),
    unit: row.unit || "g",
    nutrients: nutrientTexts(row.nutrition),
    derived: derivedFlagsOf(row.nutrition),
    nutritionBasis: row.nutrition_basis,
    altUnits: altUnitRows(row.alt_units),
    density: numberText(row.density_g_ml),
    categories: row.category ? [row.category] : [],
    notes: row.notes ?? "",
    isFavorite: Boolean(row.favorite),
    visibility: row.visibility,
    sharedBy: row._shared_by ?? null,
    sourceApp: row.source_app,
    sourceExternalId: row.source_external_id,
    sourceUrl: row.source_url,
  });
}

/**
 * A pick as a new food. For an OFF product without values the mapper's zeros
 * are blanked; show `offNotice(food.barcode, food.offInfo)` with it. Complete
 * a search hit first (`completeOffFood`).
 */
export function foodFormFromExternal(food: ExternalFood): FoodFormState {
  const nutrients = nutrientTexts(food.nutrition);
  if (offNutritionStatus(food) !== "ok") {
    for (const [id, text] of Object.entries(nutrients)) {
      if (Number(text) === 0) nutrients[id] = "";
    }
  }
  return emptyFoodForm({
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    imgUrl: food.imgUrl,
    portion: numberText(food.portion),
    unit: food.unit || "g",
    nutrients,
    derived: { ...food.derived },
    nutritionBasis: food.nutrition_basis,
    altUnits: altUnitRows(food.alt_units),
    sourceApp: food.source_app,
    sourceExternalId: food.source_external_id,
    sourceUrl: food.source_url,
  });
}

/** The nutrients typed in, as stored (known and custom ids only) */
export function foodFormNutrition(
  form: FoodFormState,
  customs: readonly CustomNutrient[] = [],
): NutritionMap {
  const out: NutritionMap = {};
  for (const id of allNutrientIds(customs)) {
    const value = parseDecimal(form.nutrients[id]);
    if (Number.isFinite(value)) out[id] = value;
  }
  return out;
}

/** Rows with a name and a positive weight; null when none are left */
export function altUnitsFromRows(
  rows: readonly AltUnitRow[],
): AltUnit[] | null {
  const out: AltUnit[] = [];
  for (const row of rows) {
    const grams = parsePositive(row.grams);
    const abbr = row.abbr.trim();
    if (abbr && grams !== null) out.push({ abbr, grams });
  }
  return out.length > 0 ? out : null;
}

export function addAltUnitRow(form: FoodFormState): FoodFormState {
  return { ...form, altUnits: [...form.altUnits, { abbr: "", grams: "" }] };
}

export function updateAltUnitRow(
  form: FoodFormState,
  index: number,
  changes: Partial<AltUnitRow>,
): FoodFormState {
  return {
    ...form,
    altUnits: form.altUnits.map((row, i) =>
      i === index ? { ...row, ...changes } : row,
    ),
  };
}

export function removeAltUnitRow(
  form: FoodFormState,
  index: number,
): FoodFormState {
  return { ...form, altUnits: form.altUnits.filter((_, i) => i !== index) };
}

/** Pressing the active basis again clears it */
export function toggleNutritionBasis(
  form: FoodFormState,
  basis: "g" | "ml",
): FoodFormState {
  return {
    ...form,
    nutritionBasis: form.nutritionBasis === basis ? null : basis,
  };
}

/** Basis, serving units and density: shown when asked for or already set */
export function shouldShowUnitMetadata(
  form: FoodFormState,
  settings: { showUnitMetadata?: boolean; warnUnitMismatch?: boolean },
): boolean {
  return Boolean(
    settings.showUnitMetadata ||
    settings.warnUnitMismatch ||
    form.nutritionBasis ||
    form.altUnits.length > 0 ||
    form.density !== "",
  );
}

export function toggleFoodCategory(
  form: FoodFormState,
  name: string,
): FoodFormState {
  return {
    ...form,
    categories: form.categories.includes(name)
      ? form.categories.filter((category) => category !== name)
      : [...form.categories, name],
  };
}

// ── Typing nutrients ────────────────────────────────────────────────────

/** Last edit wins: a positive sodium or salt recomputes the other */
export function applySaltSodiumEdit(
  form: FoodFormState,
  changedId: "salt" | "sodium",
): FoodFormState {
  const derived: DerivedFlags = { ...form.derived, [changedId]: false };
  const nutrients = { ...form.nutrients };
  const value = parseDecimal(nutrients[changedId]);
  if (Number.isFinite(value) && value > 0) {
    if (changedId === "sodium") {
      nutrients.salt = String(
        Math.round((value / SODIUM_MG_PER_SALT_G) * 1000) / 1000,
      );
      derived.salt = true;
    } else {
      nutrients.sodium = String(
        Math.round(value * SODIUM_MG_PER_SALT_G * 10) / 10,
      );
      derived.sodium = true;
    }
  }
  return { ...form, nutrients, derived };
}

export function setFoodNutrient(
  form: FoodFormState,
  id: string,
  text: string,
): FoodFormState {
  const next = { ...form, nutrients: { ...form.nutrients, [id]: text } };
  return id === "salt" || id === "sodium"
    ? applySaltSodiumEdit(next, id)
    : next;
}

/** The calories input's value; whole kJ in kJ mode */
export function caloriesInputValue(
  form: FoodFormState,
  energyUnit: EnergyUnit,
): string {
  const text = form.nutrients.calories || "";
  if (energyUnit !== "kJ") return text;
  const kcal = parseDecimal(text);
  return Number.isFinite(kcal) ? String(Math.round(kcal * KJ_PER_KCAL)) : "";
}

/**
 * kJ typed in is stored as unrounded kcal. In kJ mode keep the typed text in
 * the component while it is focused, or "100." is rewritten under the cursor.
 */
export function setCaloriesInput(
  form: FoodFormState,
  text: string,
  energyUnit: EnergyUnit,
): FoodFormState {
  if (energyUnit !== "kJ") return setFoodNutrient(form, "calories", text);
  const kj = parseDecimal(text);
  return setFoodNutrient(
    form,
    "calories",
    Number.isFinite(kj) ? String(kj / KJ_PER_KCAL) : "",
  );
}

// ── Proportional scaling (the link toggle) ──────────────────────────────

/** The values when the link was switched on */
export interface ScaleSnapshot {
  portion: number;
  nutrients: Record<string, number>;
}

/** Editing a food starts linked; a new, empty one does not */
export function shouldStartLinked(form: FoodFormState): boolean {
  return Object.values(form.nutrients).some((text) => text !== "");
}

export function takeScaleSnapshot(form: FoodFormState): ScaleSnapshot {
  const nutrients: Record<string, number> = {};
  for (const [id, text] of Object.entries(form.nutrients)) {
    nutrients[id] = parseDecimal(text) || 0;
  }
  return { portion: parseDecimal(form.portion) || 0, nutrients };
}

/**
 * Nutrients follow the typed portion, from the snapshot (4 decimals). Only
 * portion edits scale; upstream waits 400 ms after the last keystroke.
 */
export function scaleToPortion(
  form: FoodFormState,
  snapshot: ScaleSnapshot,
): FoodFormState {
  const portion = parseDecimal(form.portion);
  if (!(snapshot.portion > 0) || !(portion > 0)) return form;
  const ratio = portion / snapshot.portion;
  const nutrients = { ...form.nutrients };
  for (const [id, value] of Object.entries(snapshot.nutrients)) {
    if (value > 0) {
      nutrients[id] = String(Math.round(value * ratio * 10000) / 10000);
    }
  }
  return { ...form, nutrients };
}

// ── Saving ──────────────────────────────────────────────────────────────

export type FoodFormError = "nameRequired";

export function validateFoodForm(form: FoodFormState): FoodFormError[] {
  return form.name.trim() ? [] : ["nameRequired"];
}

/**
 * For `foodsApi.create` or `update`. Cleared texts go as "": the server's PUT
 * keeps the old value for null. A create drops the id, favourite and
 * visibility.
 */
export function foodFormToWrite(
  form: FoodFormState,
  customs: readonly CustomNutrient[] = [],
): FoodWrite {
  const isNew = form.id === null;
  return {
    name: form.name,
    brand: form.brand,
    nutrition: withDerivedFlags(foodFormNutrition(form, customs), form.derived),
    portion: parsePositive(form.portion) ?? 100,
    unit: form.unit || "g",
    img_url: form.imgUrl || null,
    notes: form.notes,
    category: form.categories[0] ?? "",
    barcode: form.barcode.trim(),
    nutrition_basis: form.nutritionBasis,
    alt_units: altUnitsFromRows(form.altUnits),
    density_g_ml: parsePositive(form.density),
    ...(isNew ? {} : { favorite: form.isFavorite }),
    ...(isNew && form.sourceApp ? { source_app: form.sourceApp } : {}),
    ...(isNew && form.sourceExternalId
      ? { source_external_id: form.sourceExternalId }
      : {}),
    ...(isNew && form.sourceUrl ? { source_url: form.sourceUrl } : {}),
  };
}

/** Another food of the user's with this barcode (leading zeros aside) */
export function findDuplicateBarcode<
  T extends { id: number; barcode?: string | null },
>(foods: readonly T[], form: FoodFormState): T | null {
  return findByBarcode(
    foods.filter((food) => food.id !== form.id),
    form.barcode,
  );
}

/** A scan into such a form fills it from OFF right away */
export function isFoodFormBlank(form: FoodFormState): boolean {
  return !form.name.trim() && !form.brand.trim() && !shouldStartLinked(form);
}

// ── Fill from OFF ───────────────────────────────────────────────────────

/** What a refresh reads of an OFF product */
export interface OffValues {
  name?: string;
  brand?: string;
  imgUrl?: string;
  portion: number;
  unit: string;
  nutrition: NutritionMap;
  derived: DerivedFlags;
  present: string[];
  isPreparedOnly: boolean;
}

export function offValuesOf(food: ExternalFood): OffValues {
  return {
    name: food.name,
    brand: food.brand,
    imgUrl: food.imgUrl,
    portion: food.portion,
    unit: food.unit,
    nutrition: food.nutrition,
    derived: food.derived,
    present: food.offInfo?.present ?? [],
    isPreparedOnly: food.offInfo?.isPreparedOnly ?? false,
  };
}

export type OffRefreshReason =
  "updated" | "upToDate" | "preparedOnly" | "noNutrition" | "unitsDiffer";

export interface OffRefreshResult {
  form: FoodFormState;
  /** How many nutrients changed */
  changed: number;
  reason: OffRefreshReason;
}

/** How much of OFF's amount the food's portion is; null if not convertible */
function portionFactor(form: FoodFormState, off: OffValues): number | null {
  const own = parseDecimal(form.portion);
  const theirs = parseDecimal(off.portion);
  if (!(theirs > 0) || !(own > 0)) return null;
  const ownUnit = (form.unit || "g").trim().toLowerCase();
  const offUnit = (off.unit || "g").trim().toLowerCase();
  const ownGrams = unitToGrams(ownUnit);
  const offGrams = unitToGrams(offUnit);
  if (ownGrams !== null && offGrams !== null) {
    return (own * ownGrams) / (theirs * offGrams);
  }
  return ownUnit === offUnit ? own / theirs : null;
}

function isSameValue(current: string | undefined, next: number): boolean {
  const value = parseDecimal(current);
  return (
    Number.isFinite(value) &&
    Math.abs(value - next) <= Math.max(0.005, Math.abs(next) * 1e-9)
  );
}

/**
 * Refresh from OFF (look up with `isLive`): only nutrients OFF has, converted
 * to the food's portion; name, brand and photo only fill when empty.
 */
export function applyOffRefresh(
  form: FoodFormState,
  off: OffValues,
  ids: readonly string[] = NUTRIMENTS.map((nutrient) => nutrient.id),
): OffRefreshResult {
  const next: FoodFormState = {
    ...form,
    name: form.name || (off.name ?? ""),
    brand: form.brand || (off.brand ?? ""),
    imgUrl: form.imgUrl || (off.imgUrl ?? ""),
    nutrients: { ...form.nutrients },
  };
  const present = new Set(off.present);
  if (present.size === 0) {
    return {
      form: next,
      changed: 0,
      reason: off.isPreparedOnly ? "preparedOnly" : "noNutrition",
    };
  }
  if (!(parseDecimal(next.portion) > 0)) {
    next.portion = numberText(off.portion);
    next.unit = off.unit;
  }
  const factor = portionFactor(next, off);
  if (factor === null) {
    return { form: next, changed: 0, reason: "unitsDiffer" };
  }
  let changed = 0;
  for (const id of ids) {
    const raw = off.nutrition[id];
    if (!present.has(id) || raw === undefined || !Number.isFinite(raw)) {
      continue;
    }
    const value = factor === 1 ? raw : Math.round(raw * factor * 100) / 100;
    if (!isSameValue(next.nutrients[id], value)) {
      next.nutrients[id] = numberText(value);
      changed += 1;
    }
  }
  // The calculated marks follow what OFF gave
  if (present.has("salt") || present.has("sodium")) {
    next.derived = {
      ...next.derived,
      salt: !!off.derived.salt,
      sodium: !!off.derived.sodium,
    };
  }
  return { form: next, changed, reason: changed ? "updated" : "upToDate" };
}

/** "Use these values": the "as prepared" ones, recorded in the notes once */
export function applyOffPrepared(
  form: FoodFormState,
  info: OffInfo | null,
  note: string,
  ids?: readonly string[],
): OffRefreshResult {
  const prepared = info?.prepared;
  const result = applyOffRefresh(
    form,
    {
      portion: prepared?.portion ?? 100,
      unit: prepared?.unit ?? "g",
      nutrition: prepared?.nutrition ?? {},
      derived: prepared?.derived ?? {},
      present: prepared?.present ?? [],
      isPreparedOnly: false,
    },
    ids,
  );
  const { reason } = result;
  const { notes } = result.form;
  if (
    (reason === "updated" || reason === "upToDate") &&
    note &&
    !notes.includes(note)
  ) {
    result.form.notes = notes.trim() ? `${notes.trim()}\n${note}` : note;
  }
  return result;
}
