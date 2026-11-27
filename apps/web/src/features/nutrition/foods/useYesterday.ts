import type { DiaryItem } from "../api";
import { loadDiaryDay } from "../diaryStore";
import { addDays, localDateStr } from "../lib/dates";
import { itemsOfMeal } from "../lib/diary";
import { liveImageFor, type PicturedSource } from "../lib/itemSource";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { useResource } from "../useResource";

export interface YesterdayGroup {
  index: number;
  name: string;
  items: DiaryItem[];
}

/**
 * Yesterday's entries by meal, pictured as their sources in `library` are
 * today; empty while not wanted or nothing was logged
 */
export function useYesterday(
  isWanted: boolean,
  library: readonly PicturedSource[],
): YesterdayGroup[] {
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const yesterday = addDays(localDateStr(), -1);
  const day = useResource(isWanted ? `yesterday-${yesterday}` : null, () =>
    loadDiaryDay(yesterday),
  );
  return settings.mealNames
    .map((name, index) => ({
      index,
      name: format.mealName(name),
      items: itemsOfMeal(day.data?.items ?? [], index).map((item) => ({
        ...item,
        imgUrl: liveImageFor(item, library),
      })),
    }))
    .filter((group) => group.items.length > 0);
}
