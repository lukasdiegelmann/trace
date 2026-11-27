import { afterEach, describe, expect, it, vi } from "vitest";

import { addDays, localDateStr } from "../lib/dates";
import { buildSystemPrompt, nutritionContext } from "./context";
import { diaryAverages, loggingStreak } from "./diaryHistory";
import { loadAssistantSettings } from "./settings";
import { emptyDay, fakeNutriTrace, fakeTurn, writtenItems } from "./testApi";
import { nutritionTools } from "./tools";
import { convertWellnessUnits } from "./wellnessUnits";

const today = localDateStr();

afterEach(() => {
  vi.restoreAllMocks();
});

function names(turn = fakeTurn()) {
  return nutritionTools(turn).map((tool) => tool.name);
}

function run(
  name: string,
  args: Record<string, unknown> = {},
  turn = fakeTurn({ hasImage: name === "propose_quick_calories" }),
) {
  const tool = nutritionTools(turn).find((entry) => entry.name === name);
  if (!tool) throw new Error(`${name} is not offered`);
  return tool.run(args);
}

const apple = {
  id: 5,
  name: "Apple",
  brand: null,
  portion: 100,
  unit: "g",
  nutrition: { calories: 52, proteins: 0.3 },
  alt_units: null,
};

const meals = ["Breakfast", "Lunch", "Second lunch", "Dinner", "Snacks"];

describe("the tool filter", () => {
  it("offers a text turn no photo estimate", () => {
    expect(names()).toContain("log_quick_calories");
    expect(names()).toContain("propose_food");
    expect(names()).not.toContain("propose_quick_calories");
  });

  it("takes the silent write away from a photo turn", () => {
    const offered = names(fakeTurn({ hasImage: true }));
    expect(offered).not.toContain("log_quick_calories");
    expect(offered).toContain("propose_quick_calories");
    expect(offered).toContain("propose_food");
  });

  it.each(["nutrition:food", "nutrition:quickCalories"])(
    "takes propose_food away while a %s card waits",
    (kind) => {
      expect(names(fakeTurn({ pending: [kind] }))).not.toContain(
        "propose_food",
      );
      expect(names(fakeTurn({ pending: [kind], hasImage: true }))).toContain(
        "propose_food",
      );
    },
  );

  it("renames the wearable's workouts", () => {
    expect(names()).toContain("get_wearable_workouts");
    expect(names()).not.toContain("get_workouts");
    expect(names()).toHaveLength(15);
    expect(names(fakeTurn({ hasImage: true }))).toHaveLength(15);
  });
});

describe("wellness units", () => {
  const imperial = { distUnit: "mi", weightUnit: "lb", tempUnit: "F" };

  it("converts distance, weights and temperature", () => {
    expect(
      convertWellnessUnits(
        { d: { distance_km: 10, weight_kg: 80, skin_temp_variation: 0.5 } },
        imperial,
      ),
    ).toEqual({
      d: { distance_mi: 6.21, weight_lb: 176.4, skin_temp_variation: 0.9 },
    });
  });

  it("converts what Withings wraps in a value", () => {
    expect(
      convertWellnessUnits({ d: { bone_mass_kg: { value: 3 } } }, imperial),
    ).toEqual({ d: { bone_mass_lb: { value: 6.61 } } });
  });

  it("leaves metric units alone", () => {
    const data = { d: { distance_km: 10, weight_kg: 80 } };
    expect(
      convertWellnessUnits(data, {
        distUnit: "km",
        weightUnit: "kg",
        tempUnit: "C",
      }),
    ).toEqual(data);
  });
});

describe("the diary's history", () => {
  const logged = (date: string, extra: object = { notes: "slept well" }) => ({
    ...emptyDay(date),
    ...extra,
  });

  it("counts the streak from yesterday while today is empty", () => {
    const days = [1, 2, 3, 5].map((back) => logged(addDays(today, -back)));
    expect(loggingStreak(days)).toMatchObject({
      streak_days: 3,
      streak_start: addDays(today, -3),
      streak_end: addDays(today, -1),
      today_logged: false,
      total_logged_days_in_history: 4,
    });
  });

  it("averages the days with food, today left out", () => {
    const food = (kcal: number, weight: number) => ({
      items: [{ nutrition: { calories: kcal }, quantity: 1 }],
      water: [{ amount: 1000 }],
      body_stats: { weight, weight_unit: "kg" },
    });
    expect(
      diaryAverages(
        [
          logged(addDays(today, -2), food(2000, 80)),
          logged(addDays(today, -1), food(2400, 79)),
          logged(today, food(9999, 90)),
        ],
        4,
      ),
    ).toMatchObject({
      period_days: 4,
      days_logged: 2,
      consistency_pct: 50,
      averages: { calories: 2200, water_ml: 1000 },
      weight_change: { change_kg: -1, direction: "down" },
    });
  });

  it("says when a period holds nothing", () => {
    expect(diaryAverages([], 7)).toEqual({
      error: "No diary data found for this period.",
    });
  });
});

describe("get_diary", () => {
  it("names meals and tags the units of body stats", async () => {
    await fakeNutriTrace({
      settings: { weightUnit: "kg", lengthUnit: "cm", mealNames: meals },
      gets: {
        [`/diary/${today}`]: {
          ...emptyDay(today),
          items: [
            {
              name: "Oats",
              meal: 2,
              quantity: 2,
              nutrition: { calories: 100 },
            },
          ],
          body_stats: { weight: 176.4, weight_unit: "lb", waist: 80 },
          water: [{ amount: 250 }],
          notes: " tired ",
        },
        [`/activity/${today}`]: [],
      },
    });
    expect(await run("get_diary", { date: today })).toMatchObject({
      meals: { "Second lunch": [{ name: "Oats", calories: 200 }] },
      totals: { calories: 200 },
      body_stats: { weight: 80, weight_unit: "kg", length_unit: "cm" },
      water_ml: 250,
      day_notes: "tired",
    });
  });
});

describe("add_activity_entry", () => {
  it("refuses while the activity section is off", async () => {
    const fake = await fakeNutriTrace();
    expect(await run("add_activity_entry", { name: "Run", kcal: 300 })).toEqual(
      {
        error: expect.stringContaining(
          "Activity logging is disabled",
        ) as string,
      },
    );
    expect(fake.writes).toEqual([]);
  });

  it("gates estimates on the setting and the profile", async () => {
    const args = { name: "Run", kcal: 0, source: "ai_estimated" };
    await fakeNutriTrace({ settings: { diaryShowActivity: true } });
    expect(await run("add_activity_entry", args)).toEqual({
      error: expect.stringContaining("Auto-estimation is off") as string,
    });
    vi.restoreAllMocks();
    await fakeNutriTrace({
      settings: { diaryShowActivity: true, activityAutoEstimate: true },
    });
    expect(await run("add_activity_entry", args)).toEqual({
      error: expect.stringContaining("missing body profile") as string,
    });
  });

  it("saves an entry, with its MET kept in range", async () => {
    const fake = await fakeNutriTrace({
      settings: { diaryShowActivity: true },
    });
    expect(
      await run("add_activity_entry", {
        name: "Hike",
        kcal: 500.4,
        met: 99,
        source: "made_up",
      }),
    ).toMatchObject({ ok: true, kcal: 500, met: 25, source: "manual_form" });
    expect(fake.writes[0]).toMatchObject({
      path: "/activity",
      body: { date: today, name: "Hike", kcal: 500, is_template: false },
    });
  });
});

describe("log_food", () => {
  it("logs the one exact local food, scaled to the amount", async () => {
    const fake = await fakeNutriTrace({
      settings: { mealNames: meals },
      gets: { "/foods": [apple, { ...apple, id: 6, name: "Apple juice" }] },
    });
    expect(
      await run("log_food", { food: "apple", meal: 4, portion: 200 }),
    ).toMatchObject({
      ok: true,
      meal_name: "Snacks",
      food_name: "Apple",
      portion: 200,
      kcal: 104,
      source: "local",
    });
    expect(writtenItems(fake)[0]).toMatchObject([
      { name: "Apple", meal: 4, portion: 200, nutrition: { calories: 104 } },
    ]);
  });

  it("asks which of several partial matches", async () => {
    const fake = await fakeNutriTrace({
      gets: {
        "/foods": [
          { ...apple, name: "Apple pie" },
          { ...apple, id: 6, name: "Apple juice" },
        ],
      },
    });
    expect(await run("log_food", { food: "apple", meal: 0 })).toMatchObject({
      candidates: [{ name: "Apple pie", source: "local" }, {}],
    });
    expect(fake.writes).toEqual([]);
  });

  it("logs nothing for a unit it can't convert", async () => {
    const fake = await fakeNutriTrace({ gets: { "/foods": [apple] } });
    expect(
      await run("log_food", {
        food: "apple",
        meal: 0,
        portion: 2,
        unit: "slice",
      }),
    ).toEqual({
      error: expect.stringContaining('Can\'t convert "slice"') as string,
    });
    expect(fake.writes).toEqual([]);
  });

  it("saves an exact Open Food Facts hit as a food and logs it", async () => {
    const fake = await fakeNutriTrace({
      gets: {
        "/foods": [],
        "/proxy": {
          hits: [
            {
              code: "1",
              product_name: "Skyr",
              nutriments: { "energy-kcal_100g": 63 },
            },
            {
              code: "2",
              product_name: "Skyr vanilla",
              nutriments: { "energy-kcal_100g": 80 },
            },
          ],
        },
      },
    });
    expect(await run("log_food", { food: "skyr", meal: 0 })).toMatchObject({
      ok: true,
      food_name: "Skyr",
      kcal: 63,
      source: "off",
    });
    expect(fake.writes[0]).toMatchObject({
      path: "/foods",
      body: { name: "Skyr", barcode: "1" },
    });
    expect(writtenItems(fake)[0]).toMatchObject([{ name: "Skyr", id: 77 }]);
  });

  it("says when nothing matches, and needs a meal", async () => {
    await fakeNutriTrace({ gets: { "/foods": [], "/proxy": { hits: [] } } });
    expect(await run("log_food", { food: "unobtainium", meal: 0 })).toEqual({
      no_match: true,
      suggestion: expect.stringContaining("unobtainium") as string,
    });
    expect(await run("log_food", { food: "apple" })).toEqual({
      error: expect.stringContaining("meal index is required") as string,
    });
  });
});

describe("log_quick_calories", () => {
  it("refuses when Quick Calories are off", async () => {
    const fake = await fakeNutriTrace({
      settings: { showQuickCalories: false },
    });
    expect(await run("log_quick_calories", { kcal: 200 })).toEqual({
      error: expect.stringContaining(
        "Quick Calories logging is disabled",
      ) as string,
    });
    expect(fake.writes).toEqual([]);
  });

  it("logs only the macros given, into the fourth meal by default", async () => {
    const fake = await fakeNutriTrace();
    expect(
      await run("log_quick_calories", { kcal: 240, protein_g: 20 }),
    ).toMatchObject({ ok: true, meal: 3, protein_g: 20, fat_g: null });
    expect(writtenItems(fake)[0]).toMatchObject([
      { type: "quick_calories", nutrition: { calories: 240, proteins: 20 } },
    ]);
  });
});

describe("the review cards", () => {
  const nutrition = { calories: 350, proteins: 20.04, made_up: 3, fat: -1 };

  it("shows a quick estimate and writes only when confirmed", async () => {
    const fake = await fakeNutriTrace();
    const turn = fakeTurn({ hasImage: true });
    expect(
      await run(
        "propose_quick_calories",
        { name: "Sandwich", meal: 1, nutrition, serving_grams: 250 },
        turn,
      ),
    ).toMatchObject({
      ok: true,
      kind: "quick_calories_proposal",
      nutrition: { calories: 350, proteins: 20 },
    });
    expect(fake.writes).toEqual([]);
    const [card] = turn.cards;
    expect(card).toMatchObject({
      kind: "nutrition:quickCalories",
      title: "Sandwich",
      select: { initial: "1" },
    });
    expect(card.rows).toContainEqual(["Serving", "~250 g"]);
    expect(await card.actions[0].run("2")).toBe("Logged 350 kcal to Dinner");
    expect(writtenItems(fake)[0]).toMatchObject([{ meal: 2 }]);
  });

  it("saves a food privately, and logs it only into a picked meal", async () => {
    const fake = await fakeNutriTrace();
    const turn = fakeTurn();
    await run("propose_food", { name: "Shake", portion: 330, nutrition }, turn);
    const [card] = turn.cards;
    const [save, saveAndLog] = card.actions;
    expect(card.select?.initial).toBe("");
    expect(saveAndLog.isEnabled?.("")).toBe(false);
    expect(saveAndLog.isEnabled?.("0")).toBe(true);
    await expect(saveAndLog.run("")).rejects.toThrow();
    expect(fake.writes).toEqual([]);

    await saveAndLog.run("0");
    expect(fake.writes[0]).toMatchObject({
      path: "/foods",
      body: { name: "Shake", portion: 330, visibility: "private" },
    });
    expect(writtenItems(fake)[0]).toMatchObject([
      { name: "Shake", meal: 0, portion: 330, nutrition: { calories: 350 } },
    ]);
    expect(await save.run("")).toBe("Saved Shake to your foods");
    expect(fake.writes.filter((w) => w.path === "/foods")).toHaveLength(1);
  });

  it("needs calories", async () => {
    await fakeNutriTrace();
    expect(await run("propose_food", { name: "x", nutrition: {} })).toEqual({
      error: "nutrition.calories must be a positive number.",
    });
  });
});

describe("the context", () => {
  it("holds meals, units, today and the profile, without a persona", async () => {
    await fakeNutriTrace({
      settings: {
        mealNames: meals,
        energyUnit: "kJ",
        goals: { calories: { max: 2000 } },
        aiGoalInsights: true,
      },
      gets: {
        "/auth/me": { user: { full_name: "Sam Doe" } },
        "/diary": [],
      },
    });
    const prompt = await nutritionContext();
    expect(prompt).toContain("  2 = Second lunch");
    expect(prompt).toContain("Goals: Calories: 8368 kJ");
    expect(prompt).toContain("name: Sam Doe");
    expect(prompt).toContain("No food logged today yet.");
    expect(prompt).toContain("Diary logging streak: 0");
    expect(prompt).toContain("GOAL INSIGHTS MODE IS ENABLED");
    expect(prompt).toContain("get_wearable_workouts");
    expect(prompt).not.toContain("You are Trace");
    expect(prompt).not.toContain("RESPONSE FORMAT");
    expect(prompt).not.toContain("Current date");
  });

  it("leaves goal insights out unless they are on", async () => {
    await fakeNutriTrace();
    const prompt = buildSystemPrompt(
      {
        profileText: "",
        userName: "",
        diaryText: "",
        goalsText: "",
        statsText: "",
        wellnessText: "",
        waterText: "",
        streakText: "",
        mealNamesText: "",
      },
      await loadAssistantSettings(),
    );
    expect(prompt).not.toContain("GOAL INSIGHTS");
    expect(prompt).not.toContain("Greet them by name");
  });
});
