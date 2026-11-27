import { Cookie, Coffee, Sandwich, Utensils } from "lucide-react";

import type { MealType } from "../lib/cookDiary";

const ICONS = {
  breakfast: Coffee,
  lunch: Sandwich,
  dinner: Utensils,
  snack: Cookie,
} as const;

export function MealIcon({
  meal,
  size = 14,
}: {
  meal: MealType;
  size?: number;
}) {
  const Icon = ICONS[meal];
  return <Icon aria-hidden size={size} />;
}
