/**
 * The one way a diary day is written, shared by the diary and the food
 * picker: read the day as the server has it, apply the change, save. Writes
 * run one after another, so two quick taps can't overwrite each other.
 */
import {
  diaryApi,
  foodsApi,
  mealsApi,
  type DiaryDay,
  type DiaryItem,
} from "./api";
import {
  appendItems,
  normalizeDay,
  toDiaryWrite,
  type DiaryMutation,
} from "./lib/diary";
import { checkDiaryGoals } from "./lib/goalChecks";

let queue: Promise<unknown> = Promise.resolve();

export async function loadDiaryDay(date: string): Promise<DiaryDay> {
  return normalizeDay(await diaryApi.day(date), date);
}

export interface MutationResult {
  day: DiaryDay;
  /** False when there was nothing to write */
  isChanged: boolean;
}

export function mutateDiaryDay(
  date: string,
  mutation: DiaryMutation,
): Promise<MutationResult> {
  const run = async (): Promise<MutationResult> => {
    const day = await loadDiaryDay(date);
    const change = mutation(day);
    if (!change) return { day, isChanged: false };
    const saved = await diaryApi.save(
      date,
      toDiaryWrite(change.day, change.deleted),
    );
    const after = normalizeDay(saved, date);
    // A reached goal is celebrated; the write doesn't wait for it
    void checkDiaryGoals(after).catch(() => {});
    return { day: after, isChanged: true };
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

type ChangeListener = (date: string) => void;

const listeners = new Set<ChangeListener>();

/** Hears of writes made past the open screens; returns the unsubscribe */
export function subscribeDiaryChanges(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * After a write the screens didn't make themselves (the assistant's): what
 * shows this day, its food or its activity, loads it again
 */
export function announceDiaryChange(date: string): void {
  for (const listener of listeners) listener(date);
}

/** Counts the use of the foods and meals logged, for "recent" and "most used" */
export function markUsed(items: DiaryItem[], date: string): void {
  for (const item of items) {
    if (typeof item.id !== "number") continue;
    const api = item.is_recipe ? mealsApi : foodsApi;
    api.markUsed(item.id, date).catch(() => {});
  }
}

export async function addToDiary(
  date: string,
  items: DiaryItem[],
): Promise<MutationResult> {
  const result = await mutateDiaryDay(date, appendItems(items));
  markUsed(items, date);
  return result;
}
