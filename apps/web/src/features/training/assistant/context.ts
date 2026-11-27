/**
 * The training part of the assistant's system prompt, in English, ported from
 * LiftTrace `components/ai/Trace.svelte` (`buildUserProfile`, `buildContext`
 * and the prompt). Only what stays stable is in here; live data comes from
 * the tools. Persona and style belong to the assistant.
 */
import { api } from "@/api";
import { settingsStores } from "@/features/shared/settings";

import { programApi, workoutApi } from "../diary/api";
import { getLtSettings } from "../diary/ltSettings";
import { addDays, dayOffset, localDateStr, parseLocalDate } from "../lib/dates";
import { toText } from "../lib/searchText";
import { ageFromDob } from "../lib/workout";
import { diaryDate } from "./diary";

/** Facts the model should answer from instead of inventing them */
async function userProfile(): Promise<string> {
  const settings = getLtSettings();
  const user = await api.lt
    .me()
    .then((me) => me.user)
    .catch(() => null);
  const nickname = toText(user?.nickname).trim();
  const fullName = toText(user?.full_name).trim();
  const name = fullName === "Local User" ? "" : fullName;
  const birthday = toText(user?.birthday) || toText(settings.dob);
  const gender = toText(user?.gender) || toText(settings.gender);
  const age = ageFromDob(birthday);
  return [
    name && `name: ${name}`,
    nickname && nickname !== name && `nickname: ${nickname}`,
    age != null && age > 0 && age < 130 && `age: ${age}`,
    birthday && `dob: ${birthday}`,
    gender && `gender: ${gender}`,
  ]
    .filter(Boolean)
    .join(", ");
}

async function activeProgramLine(): Promise<string | null> {
  try {
    const active = (await programApi.list()).find((p) => p.is_active);
    return active?.name ? `Active program: ${active.name}` : null;
  } catch {
    return null;
  }
}

async function recentLine(today: string): Promise<string | null> {
  try {
    const trained = (await workoutApi.recent(7)).filter(
      (w) =>
        (w.date ?? "") <= today &&
        w.exercises.some((e) =>
          (e.sets ?? []).some((s) => s.completed && !s.warmup),
        ),
    );
    const weekStart = addDays(today, -6);
    const days = new Set(
      trained.flatMap((w) => (w.date && w.date >= weekStart ? [w.date] : [])),
    );
    const line = `Trained on ${days.size} of the last 7 days.`;
    const last = trained.at(0);
    if (!last?.date) return `${line} No completed sets in the window.`;
    const ago = -dayOffset(last.date, today);
    const when =
      ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`;
    return `${line} Last session: ${when}${last.name ? ` (${last.name})` : ""}.`;
  } catch {
    return null;
  }
}

export async function trainingContext(): Promise<string> {
  await settingsStores.lt.ensureLoaded();
  const { weightUnit } = getLtSettings();
  const { weeklyWorkoutGoal } = settingsStores.lt.getSnapshot().values;
  // The real date, not the one the diary shows (issue #92): a browsed-to day
  // called "today" is how a model queries the wrong period
  const today = localDateStr();
  const weekday = parseLocalDate(today).toLocaleDateString("en-US", {
    weekday: "long",
  });
  const shown = diaryDate();
  const [profile, ...lines] = await Promise.all([
    userProfile(),
    activeProgramLine(),
    recentLine(today),
  ]);
  const live = lines.filter(Boolean).join("\n");

  return `The user tracks weight in ${weightUnit}. Weekly workout goal: ${weeklyWorkoutGoal}/week.

Today is ${weekday}, ${today}.${shown !== today ? ` The diary is currently open on ${shown}; use that date when the user says "this workout" or "log this".` : ""}

Dates: only pass date_from, date_to or date when the user named a specific date or period. Otherwise leave them out so the tool defaults apply. Never guess a year. If a tool result carries a note saying your dates found nothing, believe the note and use its results; do not tell the user the data is missing.

USER PROFILE (facts about the user, not numbers to hallucinate around; when asked "what's my name / age / gender", answer directly from this block; don't say you don't know):
${profile || "(no profile data set yet; if the user asks about their name, age, or gender, politely tell them to fill it in via Settings, My Profile)"}
${live ? `\n${live}\n` : ""}
You have live tools for everything else about training. Prefer a tool call over guessing:
- Reads: get_workouts, get_workout, get_exercises, get_exercise, get_programs, get_program, get_active_program, get_prs, get_body_stats, get_progress_photos, get_cardio, get_stats_overview, get_coach_prescription.
- Writes: log_workout, add_exercise_to_diary, log_set, log_body_stat, log_cardio, start_workout_from_template, set_active_program, add_coach_prescription (coaches only).

Before generating a workout, fetch what matters: get_coach_prescription (a trainer may have set today's session; when its status is "pending" the user hasn't accepted it yet, so say they can Accept or Decline it on the Diary and don't load it for them), get_active_program if the user has one, and get_workouts for the last few days if you need recovery context. Prescribe weights at about 70-80% of the user's recent top sets for that lift; default to "BW" for bodyweight movements they've used before.

Timed exercises (plank, wall sit, dead hang, carries) are logged by duration, not reps: tool results show them with duration_sec, and log_set / log_workout take duration_sec in seconds instead of reps. Never report a hold's seconds as reps.

Cardio is logged in its own table and does NOT appear in get_workouts or get_stats_overview. Call get_cardio before commenting on weekly training load, conditioning or recovery, and use log_cardio (not log_workout) for runs, rides, rows and walks.

get_progress_photos returns dates, counts and the weight logged that day, never image content. You cannot see a user's progress photos. If they want your eyes on one, ask them to attach it to a message.

Data annotations you may see in tool results: "225lbs×5 @8" carries an RPE 6-10 suffix (higher = closer to failure); rising RPE on the same load across sessions signals accumulating fatigue and suggests a deload. Warm-up sets are already excluded from volume and PR counts.

Workout format: after any workout you prescribe, add ONE plain text line beginning with the literal token "PLAN:" (no markdown, no code fences, no asterisks) in comma-separated Smart-Add syntax:
  PLAN: <exercise> <sets>x<reps> @ <weight><unit>, <exercise> <sets>x<reps> @ <weight><unit>, ...
Examples:
  PLAN: bench press 3x5 @ 185lbs, OHP 3x8 @ 95lbs, dips 3x10 @ BW, tricep pushdown 3x12 @ 50lbs
  PLAN: squat 5x5 @ 225lbs, RDL 3x8 @ 185lbs, leg press 3x12 @ 270lbs, calf raise 4x15 @ BW
  PLAN: deadlift 3x5 @ 315lbs, plank 3x60s @ BW, farmer carry 3x40s @ 70lbs
Timed exercises (planks, holds, carries) take a duration with an "s" suffix in place of reps, as in the last example. The examples are in lbs; write the user's unit, ${weightUnit}.

Follow the PLAN line with a SHORT rationale (1-3 sentences) explaining the choices. The app surfaces a one-tap "Use This Workout" button under any reply containing a PLAN line, so the line MUST be parseable Smart-Add syntax. For general questions (form, recovery, programming theory) DO NOT include a PLAN line; only emit one when the user is actually asking for a session to perform.`;
}
