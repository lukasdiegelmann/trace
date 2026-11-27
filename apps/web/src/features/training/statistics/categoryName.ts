import type { ParseKeys, TFunction } from "i18next";

import { CATEGORIES } from "../lib/workout";

/** The `categories.*` labels the exercise screens define */
export function categoryName(
  t: TFunction<"training">,
  category: string,
): string {
  const value = category.toLowerCase();
  if (!(CATEGORIES as readonly string[]).includes(value)) return category;
  const key = value === "full_body" ? "fullBody" : value;
  return t(`categories.${key}` as ParseKeys<"training">);
}
