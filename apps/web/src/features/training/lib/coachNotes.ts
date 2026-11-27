import type { CoachFeedback } from "./workoutTypes";

/** The notes about one exercise: by uuid, else by position (older notes) */
export function notesForExercise(
  feedback: CoachFeedback[],
  uuid: string | undefined,
  idx: number,
): CoachFeedback[] {
  return feedback.filter((note) =>
    note.exercise_uuid
      ? note.exercise_uuid === uuid
      : note.exercise_idx === idx,
  );
}

/** Notes about the whole workout */
export function workoutNotes(feedback: CoachFeedback[]): CoachFeedback[] {
  return feedback.filter(
    (note) => note.exercise_idx == null && !note.exercise_uuid,
  );
}
