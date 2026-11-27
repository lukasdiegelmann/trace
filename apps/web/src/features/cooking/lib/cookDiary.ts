/** The cook diary's views and the heatmap (CookDiary and CookHeatmap) */
import type { CookEntry, HeatmapDay } from "../diaryApi";

import { isoDate, toDate } from "./relativeTime";
import { foldText } from "./searchText";

export type DiaryView = "list" | "month" | "photos";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export function asMealType(value: string | null | undefined): MealType | null {
  return MEAL_TYPES.find((meal) => meal === value) ?? null;
}

/** `photos` (a JSON array) or the older single `photo_url` */
export function entryPhotos(
  entry: Pick<CookEntry, "photos" | "photo_url"> | null | undefined,
): string[] {
  if (!entry) return [];
  const { photos } = entry;
  if (Array.isArray(photos)) return photos.filter(Boolean);
  if (typeof photos === "string" && photos) {
    try {
      const parsed: unknown = JSON.parse(photos);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (url): url is string => typeof url === "string" && url !== "",
        );
      }
    } catch {
      // Not JSON: fall back to the single photo.
    }
  }
  return entry.photo_url ? [entry.photo_url] : [];
}

export interface DiaryFilter {
  recipeId: number | null;
  meal: MealType | null;
  query: string;
}

/** Recipe, meal type and text (recipe, notes, cook) apply to all views */
export function filterEntries(
  entries: readonly CookEntry[],
  { recipeId, meal, query }: DiaryFilter,
): CookEntry[] {
  const needle = foldText(query).trim();
  return entries.filter(
    (entry) =>
      (recipeId === null || entry.recipe_id === recipeId) &&
      (meal === null || entry.meal_type === meal) &&
      (!needle ||
        [
          entry.recipe_name,
          entry.notes,
          entry.cooked_by_full_name || entry.cooked_by_username,
        ].some((text) => foldText(text).includes(needle))),
  );
}

export interface DiaryDay {
  date: string;
  /** Today or later */
  isUpcoming: boolean;
  entries: CookEntry[];
}

/** Today and the future first, then the past; latest first in each */
export function groupByDate(
  entries: readonly CookEntry[],
  today: string,
): DiaryDay[] {
  const days = new Map<string, CookEntry[]>();
  for (const entry of entries) {
    const day = days.get(entry.date);
    if (day) day.push(entry);
    else days.set(entry.date, [entry]);
  }
  return [...days.entries()]
    .map(([date, list]) => ({
      date,
      isUpcoming: date >= today,
      entries: list,
    }))
    .sort(
      (a, b) =>
        Number(b.isUpcoming) - Number(a.isUpcoming) ||
        b.date.localeCompare(a.date),
    );
}

export interface PhotoTile {
  entry: CookEntry;
  url: string;
  index: number;
  count: number;
}

/** One tile per photo, newest cook first, a cook's photos in order */
export function photoTiles(entries: readonly CookEntry[]): PhotoTile[] {
  return entries
    .flatMap((entry) => {
      const photos = entryPhotos(entry);
      return photos.map((url, index) => ({
        entry,
        url,
        index,
        count: photos.length,
      }));
    })
    .sort(
      (a, b) =>
        b.entry.date.localeCompare(a.entry.date) ||
        (b.entry.created_at ?? "").localeCompare(a.entry.created_at ?? "") ||
        a.index - b.index,
    );
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfMonth(date: Date, offset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

/** The diary's range: month view ±1 month, else all up to 30 days ahead */
export function diaryRange(
  view: DiaryView,
  month: Date,
  today: Date,
): { from: string; to: string } {
  if (view === "month") {
    return {
      from: isoDate(startOfMonth(month, -1)),
      to: isoDate(addDays(startOfMonth(month, 2), -1)),
    };
  }
  // From the start: imported history reaches back years.
  return { from: "1970-01-01", to: isoDate(addDays(today, 30)) };
}

export interface MonthCell {
  date: string;
  day: number;
  isInMonth: boolean;
  isToday: boolean;
  entries: CookEntry[];
}

/** Six weeks from the week holding the 1st; `firstDay` 0 is Sunday */
export function monthCells(
  month: Date,
  entries: readonly CookEntry[],
  today: string,
  firstDay: 0 | 1,
): MonthCell[] {
  const first = startOfMonth(month);
  const start = addDays(first, -((first.getDay() - firstDay + 7) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const iso = isoDate(date);
    return {
      date: iso,
      day: date.getDate(),
      isInMonth: date.getMonth() === month.getMonth(),
      isToday: iso === today,
      entries: entries.filter((entry) => entry.date === iso),
    };
  });
}

export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return count <= 4 ? 3 : 4;
}

export interface HeatCell {
  date: string;
  count: number;
  isFuture: boolean;
}

export interface HeatWeek {
  days: HeatCell[];
  /** Set on the first week of a month: its first day, for the label */
  monthStart: string | null;
}

/** `weeks` full weeks plus the current one, Sunday to Saturday */
export function heatmapWeeks(
  data: readonly HeatmapDay[],
  today: Date,
  weeks = 52,
): HeatWeek[] {
  const counts = new Map(data.map((day) => [day.date, day.count]));
  const todayIso = isoDate(today);
  const start = addDays(toDate(todayIso), -(weeks * 7) - today.getDay());
  let lastMonth = -1;
  return Array.from({ length: weeks + 1 }, (_, week) => {
    const sunday = addDays(start, week * 7);
    const isMonthStart =
      sunday.getDate() <= 7 && sunday.getMonth() !== lastMonth;
    if (isMonthStart) lastMonth = sunday.getMonth();
    return {
      monthStart: isMonthStart ? isoDate(sunday) : null,
      days: Array.from({ length: 7 }, (_, day) => {
        const date = isoDate(addDays(sunday, day));
        const isFuture = date > todayIso;
        return {
          date,
          isFuture,
          count: isFuture ? 0 : (counts.get(date) ?? 0),
        };
      }),
    };
  });
}

export function heatmapTotals(data: readonly HeatmapDay[]): {
  total: number;
  activeDays: number;
} {
  return {
    total: data.reduce((sum, day) => sum + day.count, 0),
    activeDays: data.filter((day) => day.count > 0).length,
  };
}
