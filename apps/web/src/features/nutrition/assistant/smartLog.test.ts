import { afterEach, describe, expect, it, vi } from "vitest";

import { addDays, localDateStr } from "../lib/dates";
import { loadAssistantSettings } from "./settings";
import {
  canLog,
  defaultAmount,
  isLogged,
  matchItems,
  parseReply,
  pickCandidate,
  resolveMealSlot,
  reviewRows,
  rowCalories,
  saveRows,
  SmartLogParseError,
  waterAmount,
  type ParsedItem,
} from "./smartLog";
import { emptyDay, fakeNutriTrace, writtenItems } from "./testApi";

const today = localDateStr();

afterEach(() => {
  vi.restoreAllMocks();
});

const item = (fields: Partial<ParsedItem>): ParsedItem => ({
  name: "x",
  quantity: 1,
  unit: null,
  kind: "food",
  ...fields,
});

describe("parseReply", () => {
  it("reads fenced JSON and tidies the items", () => {
    expect(
      parseReply(
        '```json\n{"meal":"Lunch","items":[{"name":" eggs ","quantity":2},{"name":"toast","quantity":0,"unit":"slice","kind":"odd"},{"quantity":1}]}\n```',
      ),
    ).toEqual({
      meal: "Lunch",
      items: [
        { name: "eggs", quantity: 2, unit: null, kind: "food" },
        { name: "toast", quantity: 1, unit: "slice", kind: "food" },
      ],
    });
  });

  it("refuses prose", () => {
    expect(() => parseReply("Sure! Two eggs.")).toThrow(SmartLogParseError);
  });
});

describe("resolveMealSlot", () => {
  const slots = ["Morning Bowl", "Lunch", "Pre-workout", "Snack 1", "Snack 2"];

  it.each([
    ["lunch", 1],
    ["Pre-workout meal", 2],
    ["breakfast", 0],
    ["snack", 3],
    ["supper club", null],
    [null, null],
  ])("%s is slot %s", (name, slot) => {
    expect(resolveMealSlot(name, slots)).toBe(slot);
  });
});

describe("water", () => {
  const containers = [{ id: "1", name: "Protein shaker", volumeMl: 700 }];

  it("takes the user's container first", () => {
    expect(
      waterAmount(item({ name: "protein shaker", quantity: 2 }), containers),
    ).toEqual({ amountMl: 1400, containerName: "Protein shaker" });
  });

  it.each([
    [{ name: "water", quantity: 500, unit: "ml" }, 500],
    [{ name: "water", quantity: 1.5, unit: "L" }, 1500],
    [{ name: "glass", quantity: 2, unit: "glass" }, 480],
    [{ name: "drink" }, 250],
  ])("measures %o", (fields, ml) => {
    expect(waterAmount(item(fields), []).amountMl).toBe(ml);
  });
});

const bread = {
  id: 1,
  name: "Toast bread",
  brand: null,
  portion: 40,
  unit: "g",
  nutrition: { calories: 100 },
};
const bowl = {
  id: 9,
  name: "Morning bowl",
  items: [
    { name: "Oats", portion: 50, unit: "g", nutrition: { calories: 190 } },
    { name: "Milk", portion: 200, unit: "ml", nutrition: { calories: 94 } },
  ],
  nutrition: { calories: 284 },
};

describe("matching and saving", () => {
  async function setUp() {
    const fake = await fakeNutriTrace({
      gets: {
        "/foods": [bread, { ...bread, id: 2, name: "Toast bread dark" }],
        "/diary": [{ ...emptyDay("2026-01-01"), items: [{ id: 2 }] }],
        "/meals": [bowl],
        "/proxy": {
          hits: [
            { code: "3", product_name: "Mix", nutriments: {} },
            {
              code: "4",
              product_name: "Mix ready",
              nutriments: { "energy-kcal_100g": 200 },
            },
          ],
        },
        [`/diary/${addDays(today, -1)}`]: {
          ...emptyDay(addDays(today, -1)),
          items: [
            { uuid: "a", name: "Soup", meal: 1, nutrition: { calories: 80 } },
          ],
        },
      },
    });
    return { fake, settings: await loadAssistantSettings() };
  }

  it("ranks local foods by use and amounts by what was said", async () => {
    const { settings } = await setUp();
    const [match] = await matchItems(
      [item({ name: "toast", quantity: 2 })],
      settings,
    );
    expect(match.candidates.map((c) => c.type === "food" && c.food.id)).toEqual(
      [2, 1],
    );
    expect(defaultAmount(match.item, match.candidates[0])).toBe("80");
    expect(
      defaultAmount(item({ quantity: 150, unit: "g" }), match.candidates[0]),
    ).toBe("150");
  });

  it("suggests the Open Food Facts hit that has values", async () => {
    const { settings } = await setUp();
    const [row] = reviewRows(
      await matchItems([item({ name: "mix" })], settings),
      null,
      settings.mealNames,
    );
    expect(row.candidates[0]).toMatchObject({ food: { name: "Mix ready" } });
    expect(canLog(row)).toBe(true);
    const empty = pickCandidate(row, 1);
    expect(canLog(empty)).toBe(false);
    expect(isLogged(empty)).toBe(false);
  });

  it("expands meals and yesterday, adds water, in one write", async () => {
    const { fake, settings } = await setUp();
    const matches = await matchItems(
      [
        item({ name: "morning bowl", kind: "meal" }),
        item({ name: "Lunch", kind: "yesterday" }),
        item({ name: "water", quantity: 300, unit: "ml", kind: "water" }),
        item({ name: "toast bread" }),
        item({ name: "nothing like it", kind: "recipe" }),
      ],
      settings,
    );
    fake.gets["/meals"] = [];
    const rows = reviewRows(matches, "dinner", settings.mealNames);
    expect(rows.map(isLogged)).toEqual([true, true, true, true, false]);
    expect(rows.map(rowCalories).slice(0, 4)).toEqual([284, 80, null, 100]);
    rows[3] = { ...rows[3], amount: "80", meal: 0 };

    expect(await saveRows(rows, today, () => "8:00")).toBe(5);
    const writes = writtenItems(fake);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject([
      { name: "Oats", meal: 2 },
      { name: "Milk", meal: 2 },
      { name: "Soup", meal: 2 },
      { name: "Toast bread dark", meal: 0, nutrition: { calories: 200 } },
    ]);
    expect(
      fake.writes.find((write) => write.path === `/diary/${today}`)?.body,
    ).toMatchObject({ water: [{ amount: 300, time: "8:00" }] });
  });

  it("writes nothing for rows left out", async () => {
    const { fake, settings } = await setUp();
    const rows = reviewRows(
      await matchItems([item({ name: "toast" })], settings),
      null,
      settings.mealNames,
    ).map((row) => ({ ...row, isIncluded: false }));
    expect(await saveRows(rows, today, () => "")).toBe(0);
    expect(fake.writes).toEqual([]);
  });
});
