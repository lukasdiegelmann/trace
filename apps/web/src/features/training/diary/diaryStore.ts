/**
 * The one diary store of the app. It lives outside React, so a waiting save
 * still goes out after leaving the diary.
 */
import { localDateStr } from "../lib/dates";
import { createWorkoutStore, type WorkoutStore } from "../lib/workoutStore";
import { workoutApi } from "./api";

const create = () => createWorkoutStore(workoutApi, localDateStr());

export let diaryStore: WorkoutStore = create();

/** For tests: a store without anything remembered */
export function resetDiaryStore(): void {
  diaryStore = create();
}
