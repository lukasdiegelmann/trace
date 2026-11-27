/** What the Smart Log review does: reading the words and saving the result */
import { askAi, loadAiSetup, parseJsonReply } from "@/features/shared/ai";

import { diaryStore } from "../diary/diaryStore";
import { getExercises } from "../exercises/api";
import {
  matchExercises,
  mergeIntoWorkout,
  PARSE_SYSTEM_PROMPT,
  readParsedExercises,
  type MatchedExercise,
} from "../lib/smartLog";

/** null: the model's answer wasn't a session */
export async function readSession(
  text: string,
  signal: AbortSignal,
): Promise<MatchedExercise[] | null> {
  const setup = await loadAiSetup();
  const reply = await askAi(
    setup.config,
    {
      messages: [{ role: "user", content: text }],
      systemPrompt: PARSE_SYSTEM_PROMPT,
      signal,
    },
    setup.shouldUseProxy,
  );
  const parsed = readParsedExercises(parseJsonReply(reply));
  if (!parsed) return null;
  return parsed.length ? matchExercises(parsed, await getExercises()) : [];
}

/** Adds the exercises to the workout open in the diary */
export async function saveToDiary(matched: MatchedExercise[]): Promise<void> {
  const { date, sessionId } = diaryStore.state.get();
  // The diary may never have been opened, or hold an old copy: read it first
  await diaryStore.load(date, sessionId);
  const { log, loadError, date: shown } = diaryStore.state.get();
  if (loadError) throw loadError;
  if (shown !== date) throw new Error("The diary moved to another day");
  const workout = log ?? { exercises: [] };
  await diaryStore.save(date, {
    ...workout,
    exercises: mergeIntoWorkout(matched, workout.exercises),
  });
}
