import {
  Coffee,
  Cookie,
  CupSoda,
  Sandwich,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { mealKind, type MealKind } from "@/lib/mealKind";

const ICONS: Record<MealKind, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sandwich,
  dinner: UtensilsCrossed,
  snack: Cookie,
  drink: CupSoda,
  other: Utensils,
};

/** An icon for a meal slot by keywords in its name */
export function MealIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[mealKind(name)];
  return <Icon aria-hidden size={size} />;
}
