import { describe, expect, it } from "vitest";

import { nextBackupAt } from "./backup";
import { catalogNameFromFile, inPool, parseCatalogJson } from "./catalog";
import { mapRecipe, totalGrams } from "./cooktraceImport";
import { activityCsv, diaryCsv, fullNutritionCsv } from "./csvExport";
import { monthsAgo } from "./dates";
import {
  buildCsvTemplate,
  buildJsonTemplate,
  parseFoodCsv,
  parseFoodJson,
  splitDuplicates,
} from "./foodImport";
import { calculateNutrition, deriveSodiumSalt } from "./nutritionCalc";

describe("bulk food import", () => {
  it("reads its own templates", () => {
    const json = parseFoodJson(buildJsonTemplate());
    expect(json.errors).toEqual([]);
    expect(json.valid[0]?.nutrition.calories).toBe(200);
    const csv = parseFoodCsv(buildCsvTemplate());
    expect(csv.errors).toEqual([]);
    expect(csv.valid[0]).toMatchObject({
      name: "Example Food",
      portion: 100,
      barcode: null,
    });
  });

  it("keeps quoted commas, quotes and newlines, and skips a BOM", () => {
    const text =
      '﻿name,calories,brand,extra\r\n"Bread, ""dark""",250,"Baker\nLtd",x\r\n';
    expect(parseFoodCsv(text).valid[0]).toMatchObject({
      name: 'Bread, "dark"',
      brand: "Baker\nLtd",
      unit: "g",
    });
  });

  it("names what is wrong, by row", () => {
    expect(parseFoodJson("{").errors[0]?.code).toBe("invalidJson");
    expect(parseFoodJson("{}").errors[0]?.code).toBe("notAList");
    expect(parseFoodJson('[1,{"name":"a"},{"calories":1}]').errors).toEqual([
      { row: 1, code: "notAnObject" },
      { row: 2, code: "missingCalories" },
      { row: 3, code: "missingName" },
    ]);
    expect(parseFoodCsv("name\n").errors[0]?.code).toBe("csvTooShort");
    expect(parseFoodCsv("name,kcal\na,1").errors[0]?.code).toBe("csvHeader");
  });

  it("skips barcodes that exist or repeat", () => {
    const foods = parseFoodJson(
      '[{"name":"a","calories":1,"barcode":"1"},{"name":"b","calories":1,"barcode":"2"},{"name":"c","calories":1,"barcode":"2"},{"name":"d","calories":1}]',
    ).valid;
    const split = splitDuplicates(foods, ["1"]);
    expect(split.ready.map((f) => f.name)).toEqual(["b", "d"]);
    expect(split.duplicates.map((f) => f.name)).toEqual(["a", "c"]);
  });
});

describe("nutrition", () => {
  it("multiplies by servings and derives salt from sodium", () => {
    expect(
      calculateNutrition({ quantity: 2, nutrition: { sodium: 400 } }),
    ).toEqual({ sodium: 800, salt: 2 });
    expect(deriveSodiumSalt({ salt: 1 }).sodium).toBe(400);
    expect(
      calculateNutrition({
        _splitItems: [
          { nutrition: { calories: 10 } },
          { nutrition: { calories: 5 } },
        ],
      }).calories,
    ).toBe(15);
    expect(calculateNutrition({ calories_kcal: "90" }).calories).toBe(90);
  });
});

describe("CSV exports", () => {
  const diary = [
    {
      date: "2026-01-02",
      items: [
        {
          meal: 1,
          name: 'Say "cheese", please',
          portion: 30,
          unit: "g",
          nutrition: { calories: 101.4, fat: 8.25 },
        },
      ],
    },
  ];

  it("escapes names", () => {
    expect(diaryCsv(diary).split("\n")[1]).toBe(
      '2026-01-02,1,"Say ""cheese"", please",30,g,101,8.3,0.0,0.0',
    );
  });

  it("names meals and leaves absent nutrients empty", () => {
    const [header, row] = fullNutritionCsv(
      diary,
      ["Breakfast", "Lunch"],
      [{ id: "custom_x", label: "X", unit: "mg" }],
      (id) => id,
    ).split("\n");
    expect(header.startsWith("Date,Time,Meal,Food,Brand,Amount,Unit,")).toBe(
      true,
    );
    expect(header.endsWith("X (mg)")).toBe(true);
    expect(row).toContain(",Lunch,");
    expect(row).toContain(",101.4,");
    expect(row.endsWith(",")).toBe(true);
  });

  it("writes activities", () => {
    expect(
      activityCsv([{ date: "2026-01-02", name: "Run", kcal: -3, met: 8 }]),
    ).toContain("2026-01-02,Run,0,,,manual_form,8.0,0");
  });
});

describe("CookTrace recipes", () => {
  it("keeps nutrition per serving and weighs only weights", () => {
    const meal = mapRecipe({
      id: 5,
      name: "Soup",
      servings: 4,
      nutrition: { calories: 200 },
      items: [
        { name: "Water", portion: 1, unit: "kg" },
        { name: "Salt", portion: 1, unit: "tsp" },
        { name: "Yolk", portion: 4 },
      ],
    });
    expect(meal.nutrition.calories).toBe(200);
    expect(meal.portion).toBe(250);
    expect(meal.source_external_id).toBe("recipe:5");
    expect(meal.items[2]?.unit).toBe("");
    expect(totalGrams([])).toBe(100);
  });
});

describe("custom catalogs", () => {
  it("accepts a list or { exercises }", () => {
    expect(parseCatalogJson("[1]")).toEqual({ exercises: [1] });
    expect(parseCatalogJson('{"exercises":[]}')).toEqual({ error: "empty" });
    expect(parseCatalogJson("{}")).toEqual({ error: "notAList" });
    expect(parseCatalogJson("x")).toMatchObject({ error: "invalid" });
    expect(catalogNameFromFile("my_push-pull.json")).toBe("my push pull");
  });

  it("runs a pool over every item", async () => {
    const seen: number[] = [];
    await inPool([1, 2, 3, 4, 5], 2, async (n) => {
      await Promise.resolve();
      seen.push(n);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("monthsAgo", () => {
  it("stays in the target month", () => {
    expect(monthsAgo(1, new Date(2026, 2, 31))).toBe("2026-02-28");
    expect(monthsAgo(6, new Date(2026, 4, 15))).toBe("2025-11-15");
  });
});

describe("next backup", () => {
  const now = new Date(2026, 0, 10, 12, 0);
  it("is today while the time is ahead, else a later day", () => {
    expect(nextBackupAt({ schedule: "off", time: "03:00" }, now)).toBeNull();
    expect(nextBackupAt({ schedule: "daily", time: "13:00" }, now)).toEqual(
      new Date(2026, 0, 10, 13, 0),
    );
    expect(nextBackupAt({ schedule: "daily", time: "03:00" }, now)).toEqual(
      new Date(2026, 0, 11, 3, 0),
    );
  });

  it("waits a whole interval after the last run", () => {
    expect(
      nextBackupAt(
        {
          schedule: "weekly",
          time: "13:00",
          lastAutoRun: new Date(2026, 0, 9, 13, 0).toISOString(),
        },
        now,
      ),
    ).toEqual(new Date(2026, 0, 16, 13, 0));
  });
});
