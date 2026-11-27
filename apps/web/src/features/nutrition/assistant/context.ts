/**
 * NutriTrace's part of the system prompt (Trace.svelte `buildContext` and
 * `buildSystemPrompt`), without persona, date and formatting rules, which the
 * assistant adds. The text is English: the model reads it.
 */
import { api, type MeResponse } from "@/api";

import { diaryApi, type DiaryDay, type Goals } from "../api";
import { loadDiaryDay } from "../diaryStore";
import {
  getFitbitData,
  getGarminData,
  getWithingsData,
  getWorkouts,
  type Workout,
} from "../insights/api";
import { readBodyStat } from "../lib/bodyStats";
import { targetFor } from "../lib/dayGoals";
import { localDateStr } from "../lib/dates";
import { dayTotals, mealIndexOf, waterTotal } from "../lib/diary";
import { resolveGoalFor } from "../lib/goalResolver";
import type { WithingsByDate } from "../lib/insights/statistics";
import { flattenWithings } from "../lib/insights/wellness";
import { displayEnergy, NUTRIMENTS } from "../lib/nutrition";
import { loggingStreak } from "./diaryHistory";
import {
  loadAssistantSettings,
  mealNamesOf,
  textSetting,
  type AssistantSettings,
} from "./settings";

type User = Record<string, unknown>;

const LB_PER_KG = 2.20462;

/** Name, age and body, so the model needn't ask or look them up */
export function profileText(
  user: User,
  settings: AssistantSettings,
  now: Date = new Date(),
): { text: string; userName: string } {
  const nickname =
    textSetting(user.nickname) || textSetting(settings.localUserNickname);
  const full =
    textSetting(user.full_name) || textSetting(settings.localUserName);
  const name = full !== "Local User" ? full : "";
  const birthday = textSetting(user.birthday) || textSetting(settings.dob);
  const gender = textSetting(user.gender) || textSetting(settings.gender);
  const years = birthday
    ? Math.floor(
        (now.getTime() - new Date(birthday).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      )
    : NaN;
  const weight = (value: unknown) => {
    const kg = Number(value);
    if (!kg) return "";
    return settings.weightUnit === "lb"
      ? `${(kg * LB_PER_KG).toFixed(1)} lb`
      : `${kg.toFixed(1)} kg`;
  };
  const height = (value: unknown) => {
    const cm = Number(value);
    if (!cm) return "";
    if (settings.heightUnit === "cm") return `${cm} cm`;
    const inches = cm / 2.54;
    return `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;
  };
  const parts: [string, string][] = [
    ["name", full],
    ["nickname", nickname !== full ? nickname : ""],
    ["age", years > 0 && years < 130 ? String(years) : ""],
    ["dob", birthday],
    ["gender", gender],
    ["height", height(settings.height_cm)],
    ["weight", weight(settings.weight_kg)],
    ["target weight", weight(settings.target_weight)],
    ["activity level", textSetting(settings.activity)],
  ];
  return {
    text: parts
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`)
      .join(", "),
    userName: nickname || name,
  };
}

function energyText(kcal: number, settings: AssistantSettings): string {
  return `${displayEnergy(kcal, settings.energyUnit)} ${settings.energyUnit}`;
}

export function diaryText(
  day: DiaryDay | null,
  settings: AssistantSettings,
): string {
  if (!day?.items.length) return "No food logged today yet.";
  const totals = dayTotals(day.items);
  const grams = (value: number | undefined) => Math.round(value || 0);
  const names = mealNamesOf(settings);
  const byMeal = new Map<number, string[]>();
  for (const item of day.items) {
    const index = mealIndexOf(item);
    const list = byMeal.get(index) ?? [];
    list.push(`${item.name} (${item.portion || 100}${item.unit || "g"})`);
    byMeal.set(index, list);
  }
  const lines = [...byMeal]
    .sort(([a], [b]) => a - b)
    .map(
      ([index, items]) =>
        `${names[index] || `Meal ${index + 1}`}: ${items.join(", ")}`,
    );
  return [
    `Totals: ${energyText(totals.calories || 0, settings)}, ${grams(totals.proteins)}g protein, ${grams(totals.carbohydrates)}g carbs, ${grams(totals.fat)}g fat.`,
    ...lines,
  ].join("\n");
}

export function goalsText(
  goals: Goals,
  date: string,
  settings: AssistantSettings,
): string {
  const calories = resolveGoalFor(goals.calories, date);
  const parts = calories ? [`Calories: ${energyText(calories, settings)}`] : [];
  for (const [id, label] of [
    ["proteins", "Protein"],
    ["carbohydrates", "Carbs"],
    ["fat", "Fat"],
  ]) {
    const grams = targetFor(goals, id, date, calories ?? 2000);
    if (grams) parts.push(`${label}: ${grams}g`);
  }
  return parts.join(", ") || "No goals set.";
}

// ── Wellness today ──────────────────────────────────────────────────────

type Metrics = Record<string, unknown>;
type Format = (value: number) => string;

const whole: Format = (value) => String(Math.round(value));
const grouped: Format = (value) => Math.round(value).toLocaleString("en-US");
const oneDecimal =
  (unit = ""): Format =>
  (value) =>
    value.toFixed(1) + unit;
const withUnit =
  (unit: string): Format =>
  (value) =>
    `${Math.round(value)}${unit}`;
const sleep: Format = (value) =>
  `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;

function distanceText(km: number, settings: AssistantSettings): string {
  return settings.distUnit === "mi"
    ? `${(km * 0.621371).toFixed(2)} mi`
    : `${km.toFixed(2)} km`;
}

function weightText(
  kg: number,
  settings: AssistantSettings,
  decimals = 1,
): string {
  return settings.weightUnit === "lb"
    ? `${(kg * LB_PER_KG).toFixed(decimals)} lbs`
    : `${kg.toFixed(decimals)} kg`;
}

function metricLine(
  source: string,
  metrics: Metrics | undefined,
  fields: [string, string, Format][],
): string {
  const parts: string[] = [];
  for (const [key, label, format] of fields) {
    const value = metrics?.[key];
    if (typeof value === "number") parts.push(`${label}: ${format(value)}`);
  }
  return parts.length ? `${source}: ${parts.join(", ")}` : "";
}

function fitbitLine(metrics: Metrics | undefined, settings: AssistantSettings) {
  const isFahrenheit = settings.tempUnit !== "C";
  const skin: Format = (celsius) => {
    const value = isFahrenheit ? (celsius * 9) / 5 : celsius;
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}${isFahrenheit ? "°F" : "°C"}`;
  };
  return metricLine("Fitbit", metrics, [
    ["steps", "Steps", grouped],
    ["active_minutes", "Active minutes", whole],
    ["active_zone_minutes", "Active zone min", whole],
    ["calories_out", "Calories burned", whole],
    ["floors", "Floors", whole],
    ["distance_km", "Distance", (km) => distanceText(km, settings)],
    ["sleep_duration_min", "Sleep", sleep],
    ["sleep_efficiency", "Sleep efficiency", withUnit("%")],
    ["sleep_score", "Sleep score", withUnit("/100")],
    ["resting_hr", "Resting HR", withUnit(" bpm")],
    ["hrv_daily_rmssd", "HRV", oneDecimal(" ms")],
    ["spo2_avg", "SpO2", oneDecimal("%")],
    ["respiratory_rate", "Respiratory rate", oneDecimal(" brpm")],
    ["vo2_max", "Cardio fitness (VO2 Max)", oneDecimal(" mL/kg/min")],
    ["skin_temp_variation", "Skin temp variation", skin],
    ["sleep_deep_min", "Deep sleep", withUnit(" min")],
    ["sleep_light_min", "Light sleep", withUnit(" min")],
    ["sleep_rem_min", "REM sleep", withUnit(" min")],
    ["sleep_wake_min", "Awake", withUnit(" min")],
    ["readiness_score", "Daily readiness", withUnit("/100")],
    ["stress_score", "Stress management", withUnit("/100")],
  ]);
}

function garminLine(metrics: Metrics | undefined, settings: AssistantSettings) {
  return metricLine("Garmin", metrics, [
    ["steps", "Steps", grouped],
    ["active_minutes", "Active minutes", whole],
    ["calories_out", "Calories burned", whole],
    ["distance_km", "Distance", (km) => distanceText(km, settings)],
    ["sleep_duration_min", "Sleep", sleep],
    ["sleep_score", "Sleep score", withUnit("/100")],
    ["resting_hr", "Resting HR", withUnit(" bpm")],
    ["hrv_daily_rmssd", "HRV", oneDecimal(" ms")],
    ["spo2_avg", "SpO2", oneDecimal("%")],
    ["body_battery_high", "Body battery peak", whole],
    ["body_battery_low", "Body battery low", whole],
    ["stress_avg", "Avg stress", withUnit("/100")],
    ["max_hr", "Max HR", withUnit(" bpm")],
    ["moderate_intensity_min", "Moderate intensity", withUnit(" min")],
    ["vigorous_intensity_min", "Vigorous intensity", withUnit(" min")],
    ["sleep_deep_min", "Deep sleep", withUnit(" min")],
    ["sleep_rem_min", "REM sleep", withUnit(" min")],
    ["respiratory_rate", "Respiratory rate", oneDecimal(" brpm")],
  ]);
}

function withingsLine(data: WithingsByDate, settings: AssistantSettings) {
  const mass: Format = (kg) => weightText(kg, settings);
  return metricLine("Withings", flattenWithings(data), [
    ["weight_kg", "Weight", mass],
    ["body_fat_pct", "Body fat", oneDecimal("%")],
    ["muscle_mass_kg", "Muscle mass", mass],
    ["bone_mass_kg", "Bone mass", (kg) => weightText(kg, settings, 2)],
    ["body_water_pct", "Body water", oneDecimal("%")],
    ["visceral_fat", "Visceral fat", oneDecimal()],
    ["vascular_age", "Vascular age", withUnit(" yrs")],
    ["metabolic_age", "Metabolic age", withUnit(" yrs")],
    ["lean_mass_kg", "Lean mass", mass],
    ["fat_mass_kg", "Fat mass", mass],
    [
      "basal_metabolic_rate",
      "BMR",
      (kcal) => `${energyText(kcal, settings)}/day`,
    ],
    ["nerve_health_score", "Nerve health", whole],
    ["pulse_wave_velocity", "Pulse wave velocity", oneDecimal(" m/s")],
    ["ecg_heart_rate", "ECG HR", withUnit(" bpm")],
    ["ecg_afib", "AFib", (value) => (value === 1 ? "Detected" : "Normal")],
  ]);
}

function workoutsLine(workouts: Workout[], settings: AssistantSettings) {
  if (!workouts.length) return "";
  const texts = workouts.map((workout) => {
    const details = [
      workout.duration_ms && `${Math.round(workout.duration_ms / 60000)} min`,
      workout.distance_km && distanceText(workout.distance_km, settings),
      workout.calories && energyText(workout.calories, settings),
      workout.avg_hr && `avg HR ${workout.avg_hr} bpm`,
      workout.max_hr && `max HR ${workout.max_hr} bpm`,
      workout.steps && `${grouped(workout.steps)} steps`,
      workout.has_gps && "GPS route recorded",
    ].filter(Boolean);
    return details.length
      ? `${workout.activity_name} (${details.join(", ")})`
      : String(workout.activity_name);
  });
  return `Workouts today: ${texts.join("; ")}`;
}

/** Best effort: a source that fails is left out */
async function wellnessText(
  today: string,
  settings: AssistantSettings,
): Promise<string> {
  const date = { date: today };
  const lines = await Promise.all(
    [
      getFitbitData(date).then((data) =>
        fitbitLine({ ...data[today] }, settings),
      ),
      getWorkouts(today).then((list) => workoutsLine(list, settings)),
      getGarminData(date).then((data) =>
        garminLine({ ...data[today] }, settings),
      ),
      getWithingsData(date).then((data) => withingsLine(data, settings)),
    ].map((line) => line.catch(() => "")),
  );
  return lines.filter(Boolean).join("\n");
}

// ── The prompt ──────────────────────────────────────────────────────────

export interface NutritionContext {
  profileText: string;
  userName: string;
  diaryText: string;
  goalsText: string;
  statsText: string;
  wellnessText: string;
  waterText: string;
  streakText: string;
  mealNamesText: string;
}

export async function buildContext(): Promise<NutritionContext> {
  const today = localDateStr();
  const settings = await loadAssistantSettings();
  const [day, me, wellness, history] = await Promise.all([
    loadDiaryDay(today).catch(() => null),
    api.nt.get<MeResponse>("/auth/me").catch(() => null),
    wellnessText(today, settings),
    diaryApi.all().catch(() => null),
  ]);
  const profile = profileText(me?.user ?? {}, settings);

  const stats: string[] = [];
  const { weightUnit, lengthUnit } = settings;
  const weight = readBodyStat(
    day?.body_stats,
    "weight",
    weightUnit,
    lengthUnit,
  );
  if (weight != null) stats.push(`Weight: ${weight} ${weightUnit}`);
  if (day?.body_stats.body_fat) {
    stats.push(`Body fat: ${day.body_stats.body_fat}%`);
  }

  const water = waterTotal(day?.water ?? []);

  // In the prompt, since small models skip the streak tool and make one up
  let streak = "";
  if (history) {
    const result = loggingStreak(history);
    const todayText = result.today_logged ? "logged" : "not yet logged";
    streak = result.streak_days
      ? `${result.streak_days} consecutive days (since ${result.streak_start}; today ${todayText})`
      : `0 (no recent logging${result.today_logged ? "" : "; today not yet logged"})`;
  }

  return {
    profileText: profile.text,
    userName: profile.userName,
    diaryText: diaryText(day, settings),
    goalsText: goalsText(settings.goals, today, settings),
    statsText: stats.join(", "),
    wellnessText: wellness,
    waterText:
      water > 0
        ? `${(water / 1000).toFixed(2)} L (${Math.round(water)} ml)`
        : "None logged",
    streakText: streak,
    mealNamesText: mealNamesOf(settings)
      .map((name, index) => `  ${index} = ${name}`)
      .join("\n"),
  };
}

const GOAL_INSIGHTS = `

GOAL INSIGHTS MODE IS ENABLED. You have permission to proactively analyze the user's actual intake vs their goals and offer evidence-based suggestions. When relevant:
- Use get_diary_averages (28 days is a good default) + get_goals to compare actual vs target
- If intake consistently differs from goals by >10% for 2+ weeks, mention it and offer to suggest an adjustment
- Consider weight trends from get_body_composition or diary body stats when making calorie goal suggestions
- Be specific: "You've averaged 1,840 kcal over 28 days vs your 2,100 goal — that's a 260 kcal gap. Want me to suggest a revised goal?"
- Always ask before changing anything — never modify goals without explicit user confirmation
- Cover all dimensions: calories, protein, carbs, fat, water — not just calories`;

export function buildSystemPrompt(
  context: NutritionContext,
  settings: AssistantSettings,
): string {
  const nutrientIds = NUTRIMENTS.map((nutrient) => nutrient.id).join(", ");
  const sections = `NUTRITION AND HEALTH DATA (NutriTrace)

You have FULL ACCESS to the user's complete health data through tools. ALWAYS use tools to look up data — NEVER guess or make up numbers. Available data:
- **Food diary**: meals, items, portions, full nutrition, plus per-item notes (prep/serving info) and free-text "day notes" the user writes about how they felt, slept, cravings, etc. (any date) — use get_diary
- **Diary averages**: average daily intake over any period + logging consistency + weight trend — use get_diary_averages
- **Logging streak**: current consecutive-days food-logging streak (walks from today/yesterday back to the first gap) — use get_logging_streak. Do NOT inflate get_diary_averages with a huge days value to infer the streak; the streak tool is authoritative and cheaper.
- **Saved meals & recipes**: the user's library of reusable meals/recipes with items, notes, and totals — use get_meals (supports a name filter)
- **Wellness metrics**: steps, calories burned, distance, active minutes, sleep (duration, stages, score, efficiency), heart rate (resting HR, HRV, SpO2), respiratory rate, readiness score, stress score, skin temp, VO2 max — from Fitbit, Garmin, Health Connect (any date range) — use get_wellness_data
- **Body composition**: weight, body fat %, muscle mass, bone mass, body water, lean/fat mass, visceral fat, vascular age, metabolic age, BMR, nerve health, ECG — from Withings (any date range) — use get_body_composition
- **Wearable workouts**: recorded exercises with duration, distance, calories, heart rate, steps, GPS (any date range) — use get_wearable_workouts
- **Nutrition goals**: calorie and macro targets — use get_goals

When the user asks about their data (steps, sleep, weight, food log, etc.) for ANY date or date range, USE THE APPROPRIATE TOOL to fetch the real data. Do not estimate or hallucinate numbers.

LOGGING STREAK — When the user asks about their food-logging streak in any phrasing ("how long have I been logging", "what's my streak", "when did I start logging", "first day I logged", "days in a row", "consecutive days"), you MUST call get_logging_streak FIRST and report the exact streak_days + streak_start values from its response. NEVER guess streak length or first-logged dates from context or memory. NEVER use get_diary_averages as a substitute. If the user pushes back ("that's wrong", "actually it's longer"), call get_logging_streak again and quote the streak_start + streak_days verbatim — do not adjust the number based on the user's claim, because the tool walks the actual diary table.

LOGGING ACTIVITY — When the user describes a workout, exercise, or physical activity ("I hiked 10 miles", "did 45 min of yoga", "burned 540 at the gym"), use add_activity_entry to log it. Rules:
- If the user provides a calorie number, trust it verbatim (source="user_stated").
- If the user does NOT provide a number, you may compute one from their body weight (use the TODAY'S SUMMARY context if available) × MET × duration / 200, then call add_activity_entry with kcal set and source="ai_estimated", and tell the user the estimate so they can correct it.
- Do not call add_activity_entry without a kcal value. The tool refuses kcal=0.
- The tool itself enforces user permission gates (Activity section toggle, auto-estimate toggle, body profile completeness) — if it returns an error, relay the explanation to the user verbatim and ask for what's missing.

YOUR MEALS (the user's meal slots, by position — pass these indices to any tool with a \`meal\` parameter):
${context.mealNamesText}

When the user names a meal ("lunch", "snacks", "second breakfast", anything they call it), find the matching entry in YOUR MEALS above and pass its index number. NEVER hardcode 0=breakfast / 1=lunch / 2=dinner / 3=snacks — that's only correct for the default meal layout, and users can rename or reorder meals. If the user's phrasing doesn't clearly map to one of YOUR MEALS, ASK them which meal they mean.

LOGGING A REAL FOOD — When the user wants to add a NAMED food to their diary ("add an apple to snacks", "log Greek yogurt for breakfast", "add 200g of chicken to dinner", "two slices of bread for lunch", "I had a Chobani yogurt"), use log_food. This is the PRIMARY food-logging path and stores full nutrition (protein, carbs, fat, fiber, sodium, vitamins, etc.). Rules:
- Pass the food name as the user said it. log_food searches the user's local catalog first, then Open Food Facts.
- Pass the meal index per YOUR MEALS above.
- For "1 apple", "a banana" — just pass food + meal; portion defaults to the food's stored serving size.
- For "200g of X" — pass portion=200, unit="g". For "two apples" — pass quantity=2 (and leave portion/unit as defaults).
- If the tool returns \`candidates\`, present the names back to the user and ask which one; then call log_food again with the chosen name as the \`food\` field.
- If the tool returns \`no_match\`, tell the user to add it via the Foods tab (barcode scan or manual entry) and then try again.
- If the tool returns \`no_nutrition\`, Open Food Facts has the product but no "as sold" values, so nothing was logged. Relay its message. Do not use log_quick_calories or any other tool to force the food in.
- DO NOT use log_quick_calories when the user names a food. Quick Calories is ONLY for kcal-number asks.
- When the tool returns ok:true, confirm using the \`meal_name\` and \`food_name\` from the tool result — do not assume the meal name from the index you passed. This is how you avoid telling the user "I added X to snacks" when it actually went to a different meal.
- MANUAL ESTIMATE PATH: if the user EXPLICITLY asks you to estimate ("don't search, just estimate it", "skip the database, estimate it yourself", "you estimate it and log it"), skip log_food and use propose_food instead. Pass a full nutrition estimate you're confident about. The user gets a review card and picks the meal and Save & Add to Diary. This is the ONLY sanctioned bypass — do not use it when the user hasn't explicitly opted out of the search.

LOGGING QUICK CALORIES — When the user gives a kcal number WITH NO FOOD NAME ("log 200 calories for lunch", "punch in 1200 kJ for dinner", "add 350 quick calories"), use log_quick_calories. This is the Fitbit-style quick-add path; no food row is created. Rules:
- If the user gave kJ, convert to kcal yourself: kcal = kj / 4.184. Pass the kcal number.
- Pass the meal index per YOUR MEALS above.
- Optional name field: if the user said "for office snack" or similar, pass that as name (max 60 chars).
- If the user named a food ("apple", "banana", "chicken breast"), use log_food NOT log_quick_calories.
- Tool refuses kcal=0 and refuses if the user has disabled Quick Calories in Settings — relay any error message verbatim.

CREATING A FOOD WITHOUT LOGGING IT (no photo): when the user asks you to add a food to their FOODS LIBRARY rather than to their diary ("create a food called X", "add X to my foods", "save X as a food but don't log it", "make a food entry for my protein shake"), call propose_food. Rules:
- propose_food is the ONLY tool that can create a food. log_food writes a diary entry, so it is the wrong tool here even though the user named a food.
- If the user says anything like "don't log it", "don't add it to my diary", "just save it", then the card's Save to Foods button is the whole point. Tell them to tap it and stop there. Do NOT call log_food afterwards, and do not treat their refusal as a reason to skip the card.
- Pass the user's own numbers when they give them. If they describe the food instead, estimate it under the honesty rules below and say the numbers are an estimate they can correct on the card.
- Ask for the serving size when the user has not said one and you cannot infer it. A food row saved against the wrong portion basis is worse than one more question.

PHOTO MEAL HANDLING — When the user attaches a MEAL PHOTO, never write to the diary directly. The user's intent decides which of these four paths you take:

1. INFO ONLY ("what is this?", "how many calories in this?", "is this healthy?", "tell me about this"): do NOT call any propose_* or log_* tool. Just describe what you see and give a brief nutrition estimate in plain text. The user is asking a question, not logging anything.

2. QUICK CALORIES PROPOSAL ("log this", "add this as quick calories", "throw this in for lunch", "just kcal it"): call propose_quick_calories. This surfaces an editable card. The food does NOT get saved as a reusable food row, just a kcal+macros diary entry for that day.

3. FOOD CATALOG PROPOSAL ("save this as a food", "add to my foods", "remember this for later", "create a food entry"): call propose_food. The card has a "Save to Foods" button. No diary write unless the user picks "Save & Add to Diary" on the same card.

4. FOOD + DIARY ("add this as a food entry to lunch", "save this and log it", "log this as a real food, not quick calories"): also call propose_food. The user picks the meal on the card and taps "Save & Add to Diary".

CRITICAL RULES for propose_quick_calories and propose_food:
- These tools DO NOT WRITE anything. They only surface a review card.
- When the tool returns ok:true, that means THE CARD WAS SHOWN, not "the food was logged". NEVER say things like "I've added X to your diary" or "Logged X to lunch" or "Saved X to your catalog" — the user has NOT yet confirmed.
- After calling, say something like "Here's my estimate — review and tap Add to Diary" (quick) or "Here's my estimate — pick Save to Foods or Save & Add to Diary" (food). Don't repeat the numbers in chat; the card shows them.

NUTRITION HONESTY RULES (applies to BOTH propose tools):
- The nutrition numbers you pass MUST be internally consistent with the serving you claim. If you say "350 kcal per 250 g of Chicken Pot Pie", those 350 kcal must actually correspond to ~250 g of that specific food based on real nutrition data — NOT a plausible-sounding number you invented to fill the schema.
- If you genuinely don't have a reliable basis (the food is unrecognizable, lighting is bad, the portion is impossible to gauge), DO NOT GUESS. Say so explicitly: "I can't reliably estimate this from the photo — what is it, and roughly how much (in grams or a familiar measure)?" The user prefers an honest "I don't know" over a fabricated 400 kcal that's actually 700.
- Always estimate serving_grams (for quick) or portion+unit (for food) from the photo whenever possible. "Per serving" is meaningless without a weight; without it the user has nothing to sanity-check against.

NUTRITION COVERAGE — populate the full profile:
- The nutrition object is keyed by NutriTrace nutriment IDs. The complete list of supported keys is: ${nutrientIds}.
- You are EXPECTED to estimate every key the food contains in a non-trivial amount, not just the four headline macros. A typical entry should include fiber, sugars, sodium, saturated-fat, and cholesterol whenever the food has them; common foods should also carry calcium, iron, potassium, and any prominent vitamins.
- The honesty rule still applies — every value must be a real estimate grounded in the food's typical profile, scaled to the portion. Don't fabricate to look thorough. But DO take the time to think through what's actually in the food rather than stopping at calories/protein/carbs/fat.
- Omit a key only when the value would genuinely round to ~0 (e.g. cholesterol in a salad) or you have no reasonable basis to estimate it.${settings.aiGoalInsights ? GOAL_INSIGHTS : ""}

IMPORTANT — User's preferred units (ALWAYS use these when presenting data):
- Weight: ${settings.weightUnit === "lb" ? "pounds (lbs)" : "kilograms (kg)"}
- Distance: ${settings.distUnit === "mi" ? "miles (mi)" : "kilometers (km)"}
- Height/length: ${settings.heightUnit === "ft" ? "feet/inches" : "centimeters"}
- Temperature: ${settings.tempUnit === "F" ? "Fahrenheit (°F)" : "Celsius (°C)"}
- Energy: ${settings.energyUnit === "kJ" ? "kilojoules (kJ)" : "kilocalories (kcal)"}
Convert all values to these units before presenting. ONLY show the preferred unit — do NOT show both or include the original metric/imperial value.

USER PROFILE (always-available context — these are facts about the user, not numbers to hallucinate around. When asked "what's my name / age / gender / how tall am I", answer directly from this block. Don't fetch a tool, don't say you don't know.):
${context.profileText || "(no profile data set yet — politely tell the user to fill it in via Settings → My Profile if they ask about their name, age, gender, height, or weight)"}
${context.userName ? "\nGreet them by name occasionally and reference it when celebrating progress — but don't overdo it (every other sentence is too much).\n" : ""}
TODAY'S SUMMARY (for quick reference — use tools for detailed or historical data):
${context.diaryText}
Goals: ${context.goalsText}
Water: ${context.waterText}
Diary logging streak: ${context.streakText || "(unknown)"}`;
  return [
    sections,
    context.statsText && `Body stats: ${context.statsText}`,
    context.wellnessText && `Wellness: ${context.wellnessText}`,
    `\nFor any "what's my streak / how long have I been logging / when did I start logging" question, the answer is in the "Diary logging streak" line above — quote it directly, do not call any tool, do not estimate or guess.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function nutritionContext(): Promise<string> {
  const [context, settings] = await Promise.all([
    buildContext(),
    loadAssistantSettings(),
  ]);
  return buildSystemPrompt(context, settings);
}
