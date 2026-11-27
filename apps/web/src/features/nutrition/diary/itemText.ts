import type { TFunction } from "i18next";

import type { DiaryItem } from "../api";
import { calculate, round1 } from "../lib/nutrition";
import { QUICK_CALORIES_NAME } from "../lib/diary";
import { amountAndUnit } from "../lib/units";
import type { NtSettings } from "../settings";
import type { NutritionFormat } from "../useNutritionFormat";

/** The stored default name of a quick entry reads in the UI's language */
export function itemName(item: DiaryItem, t: TFunction<"nutrition">): string {
  return item.type === "quick_calories" && item.name === QUICK_CALORIES_NAME
    ? t("diary.quick.defaultName")
    : item.name;
}

/** What was eaten: portion × servings */
export function totalAmount(item: DiaryItem): string {
  return amountAndUnit(
    round1((item.portion || 100) * (item.quantity || 1)),
    item.unit,
  );
}

export function itemKcal(item: DiaryItem): number {
  return calculate(item).calories || 0;
}

/** The line under a logged item's name, as the settings want it */
export function itemMeta(
  item: DiaryItem,
  settings: NtSettings,
  format: NutritionFormat,
  t: TFunction<"nutrition">,
): string {
  let amount = totalAmount(item);
  if (settings.diaryShowPortionSize && (item.quantity ?? 1) !== 1) {
    amount += ` ${t("diary.portionDetail", {
      quantity: format.number(item.quantity ?? 1, 2),
      portion: amountAndUnit(round1(item.portion || 100), item.unit),
    })}`;
  }
  const parts = [amount];
  if (settings.diaryShowBrands && item.brand) parts.push(item.brand);
  parts.push(format.energy(itemKcal(item)));
  if (settings.diaryShowTimestamps && item.addedAt) {
    parts.push(format.time(new Date(item.addedAt)));
  }
  return parts.join(" · ");
}
