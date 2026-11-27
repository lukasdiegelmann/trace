/** What a meal slot is, by keywords in its name (lib/mealIcon.js) */

export type MealKind =
  "breakfast" | "lunch" | "dinner" | "snack" | "drink" | "other";

const RULES: [string[], MealKind][] = [
  [["breakfast", "morning", "brunch", "frühstück"], "breakfast"],
  [["lunch", "noon", "midday", "mittag"], "lunch"],
  [["dinner", "supper", "evening", "abend"], "dinner"],
  [["snack", "bite", "treat"], "snack"],
  [["drink", "smoothie", "shake", "getränk"], "drink"],
];

export function mealKind(name: string): MealKind {
  const lower = name.toLowerCase();
  const rule = RULES.find(([words]) =>
    words.some((word) => lower.includes(word)),
  );
  return rule?.[1] ?? "other";
}
