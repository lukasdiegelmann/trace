import { api } from "@/api";

import type { UsageById } from "../lib/exerciseList";
import type { HistoryEntry } from "../lib/workout";

/** A row of LiftTrace's exercises table (server/routes/exercises.js) */
export interface Exercise {
  id: number;
  name: string;
  category?: string | null;
  primary_muscles?: string[] | null;
  secondary_muscles?: string[] | null;
  equipment?: string[] | null;
  instructions?: string | null;
  tips?: string | null;
  img_url?: string | null;
  gif_url?: string | null;
  video_url?: string | null;
  load_type?: string | null;
  set_type?: string | null;
  source?: string | null;
  is_global?: number | boolean | null;
  created_by?: number | null;
}

/** What POST and PUT /exercises take */
export type ExerciseInput = Omit<
  Exercise,
  "id" | "source" | "is_global" | "created_by"
>;

export function getExercises(query?: {
  search?: string;
  limit?: number;
}): Promise<Exercise[]> {
  return api.lt.get<Exercise[]>("/exercises", { query: { ...query } });
}

export function getExerciseUsage(): Promise<UsageById> {
  return api.lt.get<UsageById>("/exercises/usage");
}

export function getExercise(id: number | string): Promise<Exercise> {
  return api.lt.get<Exercise>(`/exercises/${id}`);
}

export function createExercise(input: object): Promise<Exercise> {
  return api.lt.post<Exercise>("/exercises", input);
}

export function updateExercise(
  id: number,
  input: ExerciseInput,
): Promise<Exercise> {
  return api.lt.put<Exercise>(`/exercises/${id}`, input);
}

export function deleteExercise(id: number): Promise<unknown> {
  return api.lt.delete(`/exercises/${id}`);
}

/** Every session with this exercise, newest first */
export function getExerciseHistory(
  id: number | string,
): Promise<HistoryEntry[]> {
  return api.lt.get<HistoryEntry[]>(`/workout/history/${id}`);
}

export interface UploadedMedia {
  url: string;
  kind: "img" | "gif" | "video";
}

export function uploadExerciseMedia(file: File): Promise<UploadedMedia> {
  const body = new FormData();
  body.append("file", file);
  return api.lt.post<UploadedMedia>("/upload/exercise-media", body);
}

/** Only the owner may change an exercise (server/lib/exercise-owner.js) */
export function canChangeExercise(
  exercise: Exercise,
  userId: number | undefined,
): boolean {
  return !exercise.is_global && exercise.created_by === userId;
}
