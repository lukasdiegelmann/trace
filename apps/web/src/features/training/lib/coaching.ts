/**
 * Coaching logic, after LiftTrace's stores/coaching.js, lib/coaching-view.js
 * and routes/Coaching.svelte. Pure: the screens turn the descriptors into
 * strings.
 */
import type {
  CoachActivity,
  CoachFeedback,
  CoachingState,
  LoggedExercise,
  Member,
  PersonFields,
  Prescription,
  SetClip,
  UnassignedPerson,
} from "@/features/training/coaching/api";

const count = (value: unknown): number => Number(value) || 0;

// ── Who sees what ───────────────────────────────────────────────────────────

/** Coach screen: a coach, a request to answer, or a past conversation */
export function showsCoachTab(s: CoachingState | null | undefined): boolean {
  return !!(s?.as_client || s?.requests.length || s?.past.length);
}

/** Coaching screen: the Trainer role and admins */
export function showsCoachingTab(s: CoachingState | null | undefined): boolean {
  return s?.role === "trainer" || s?.role === "admin";
}

/** The dot on Programs: something waiting for this person */
export function showsBadge(s: CoachingState | null | undefined): boolean {
  return !!s && (count(s.unread) > 0 || count(s.awaiting) > 0);
}

/** In coaching at all: a coach or a request, the Trainer role, or an admin
 *  who coaches (or asked) someone */
export function inCoachingNow(s: CoachingState | null | undefined): boolean {
  if (!s) return false;
  if (showsCoachTab(s) || s.role === "trainer") return true;
  return (
    s.role === "admin" &&
    count(s.as_coach.pending) +
      count(s.as_coach.active) +
      count(s.as_coach.recent) >
      0
  );
}

/** Unread on the Coach screen (as a client) */
export function coachUnread(s: CoachingState | null | undefined): number {
  return (
    count(s?.as_client?.unread) +
    (s?.past ?? []).reduce((sum, past) => sum + count(past.unread), 0)
  );
}

/** Unread on the Coaching screen (as a coach) */
export function clientsUnread(s: CoachingState | null | undefined): number {
  return count(s?.as_coach.unread);
}

/** The server's fingerprint (X-LT-Coaching) from a state the app holds */
export function coachingSignature(
  s: CoachingState | null | undefined,
): string | null {
  if (!s) return null;
  const client = s.as_client ? String(s.as_client.id) : "-";
  const requests = s.requests.map((x) => x.id).join(",") || "-";
  const past = s.past.map((x) => x.id).join(",") || "-";
  return `${s.role || "-"};${client};${requests};${count(s.as_coach.pending)}.${count(s.as_coach.active)};${past};${count(s.unread)};${count(s.awaiting)}`;
}

/** The conversations this account may still read */
export function readableConversationIds(
  s: CoachingState | null | undefined,
): number[] {
  return [
    s?.as_client?.id,
    ...(s?.past ?? []).map((past) => past.id),
    ...(s?.as_coach.active_ids ?? []),
  ].filter((id): id is number => id != null);
}

/** Changes when the coach's lists have to be asked for again */
export function coachCountsKey(s: CoachingState): string {
  const c = s.as_coach;
  return `${count(c.pending)}.${count(c.recent)}.${count(c.active)}.${count(c.unread)}`;
}

/** Sent requests are only asked for when there are some */
export function sentRequestCount(s: CoachingState | null | undefined): number {
  return count(s?.as_coach.pending) + count(s?.as_coach.recent);
}

// ── Dates and times ─────────────────────────────────────────────────────────

/** A server timestamp: SQLite's "YYYY-MM-DD HH:MM:SS" has no zone and is UTC */
export function serverDate(value: unknown): Date {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)
    ? new Date(`${text.replace(" ", "T")}Z`)
    : new Date(text);
}

/** A Date's local day as YYYY-MM-DD */
export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A server timestamp as the local day it falls on */
export function localDay(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const date = serverDate(ts);
  return Number.isNaN(date.getTime()) ? null : isoDay(date);
}

/** A YYYY-MM-DD in the date format of the settings (US, EU, else ISO) */
export function formatDay(day: string | null | undefined, format: string) {
  if (!day) return "";
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  if (format === "US") return `${month}/${dayOfMonth}/${date.getFullYear()}`;
  if (format === "EU") return `${dayOfMonth}/${month}/${date.getFullYear()}`;
  return day;
}

export function formatServerDay(
  ts: string | null | undefined,
  format: string,
): string {
  return formatDay(localDay(ts), format);
}

/** "Wed, Jan 3" of a YYYY-MM-DD, in the UI language */
export function formatWeekday(day: string, language: string): string {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(language, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export type RelativeTime =
  | { unit: "justNow" }
  | { unit: "minutes" | "hours" | "days"; n: number }
  | { unit: "date"; date: Date };

/** How long ago a server timestamp was */
export function activityRelative(
  occurred: string | null | undefined,
  now: number = Date.now(),
): RelativeTime | null {
  if (!occurred) return null;
  const then = serverDate(occurred);
  if (Number.isNaN(then.getTime())) return null;
  const minutes = Math.round((now - then.getTime()) / 60000);
  if (minutes < 60) {
    return minutes <= 1 ? { unit: "justNow" } : { unit: "minutes", n: minutes };
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: "hours", n: hours };
  const days = Math.round(hours / 24);
  if (days < 7) return { unit: "days", n: days };
  return { unit: "date", date: then };
}

export type RelativeDay =
  | { unit: "never" | "today" | "yesterday" }
  | { unit: "days" | "weeks"; n: number }
  | { unit: "date"; date: Date };

/** How long ago a workout's day was */
export function relativeDay(
  day: string | null | undefined,
  now: Date = new Date(),
): RelativeDay {
  if (!day) return { unit: "never" };
  const date = new Date(`${day}T12:00:00`);
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  // A client ahead in time zones can have logged "tomorrow" already.
  if (diff <= 0) return { unit: "today" };
  if (diff === 1) return { unit: "yesterday" };
  if (diff < 7) return { unit: "days", n: diff };
  if (diff < 30) return { unit: "weeks", n: Math.round(diff / 7) };
  return { unit: "date", date };
}

// ── People ──────────────────────────────────────────────────────────────────

export function memberLabel(person: PersonFields | null | undefined): string {
  return person?.full_name || person?.nickname || person?.username || "?";
}

/** The name in the Add Client list */
export function pickerName(person: UnassignedPerson): string {
  return (
    person.name || person.full_name || person.nickname || person.username || ""
  );
}

export function initial(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

// ── Activity ────────────────────────────────────────────────────────────────

export const REPLY_PREVIEW_MAX = 80;

export function truncateReply(text: string, max = REPLY_PREVIEW_MAX): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type ActivityText =
  | { type: "completed"; workout: string | null }
  | { type: "missed"; workout: string | null; date: string | null }
  | { type: "replied"; text: string }
  | { type: "repliedNote" }
  | { type: "other"; kind: string };

/** What a feed row says; `workout` null means "a workout" */
export function activityText(a: CoachActivity): ActivityText {
  const workout = a.template_name || a.prescription_name || null;
  if (a.kind === "prescription_completed") {
    return { type: "completed", workout };
  }
  if (a.kind === "prescription_missed") {
    return { type: "missed", workout, date: a.prescription_date };
  }
  if (a.kind === "feedback_reply") {
    const text = truncateReply(a.feedback_reply_text ?? "");
    return text ? { type: "replied", text } : { type: "repliedNote" };
  }
  return { type: "other", kind: a.kind };
}

export function unreadByMember(
  activity: CoachActivity[],
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const row of activity) {
    if (!row.seen_at) counts[row.member_id] = (counts[row.member_id] ?? 0) + 1;
  }
  return counts;
}

/** Unseen activity plus unread messages of one client */
export function memberBadge(
  member: Pick<Member, "id" | "unread">,
  unseen: Record<number, number>,
): number {
  return (unseen[member.id] ?? 0) + count(member.unread);
}

export function markSeen(
  activity: CoachActivity[],
  id: number | undefined,
  at: string,
): CoachActivity[] {
  return activity.map((row) =>
    id === undefined || row.id === id
      ? { ...row, seen_at: row.seen_at ?? at }
      : row,
  );
}

// ── Prescriptions ───────────────────────────────────────────────────────────

export type PrescriptionChip =
  "waiting" | "declined" | "accepted" | "completed" | "missed";

/** `today` is the coach's local day (the old UI took the UTC one) */
export function prescriptionChips(
  p: Pick<Prescription, "status" | "responded_at" | "completed" | "date">,
  today: string,
): PrescriptionChip[] {
  const chips: PrescriptionChip[] = [];
  if (p.status === "pending") chips.push("waiting");
  if (p.status === "declined") chips.push("declined");
  if (p.status === "accepted" && p.responded_at && p.completed !== 1) {
    chips.push("accepted");
  }
  if (p.completed === 1) chips.push("completed");
  if (
    p.completed === 0 &&
    p.status !== "declined" &&
    p.date &&
    p.date < today
  ) {
    chips.push("missed");
  }
  return chips;
}

// ── Set videos ──────────────────────────────────────────────────────────────

/** Every clip of each exercise, oldest first (the server sends newest first) */
export function clipsByExercise(
  clips: SetClip[] | null | undefined,
): Map<string, SetClip[]> {
  const map = new Map<string, SetClip[]>();
  for (const clip of clips ?? []) {
    if (!clip.exercise_uuid) continue;
    const list = map.get(clip.exercise_uuid) ?? [];
    list.unshift(clip);
    map.set(clip.exercise_uuid, list);
  }
  return map;
}

/** The set a clip is on, 1-based, or null when the set is gone */
export function clipSetNumber(
  exercise: LoggedExercise | null | undefined,
  clip: Pick<SetClip, "set_uuid"> | null | undefined,
): number | null {
  if (!clip?.set_uuid) return null;
  const index = (exercise?.sets ?? []).findIndex(
    (set) => set.uuid === clip.set_uuid,
  );
  return index >= 0 ? index + 1 : null;
}

/** A video position as m:ss */
export function videoClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// ── Notes on a workout ──────────────────────────────────────────────────────

export function workoutLevelFeedback(
  feedback: CoachFeedback[] | null | undefined,
): CoachFeedback[] {
  return (feedback ?? []).filter((f) => f.exercise_idx == null);
}

/** The notes of the exercise at `index`: by uuid when a note has one */
export function feedbackForExercise(
  exercises: LoggedExercise[],
  feedback: CoachFeedback[] | null | undefined,
  index: number,
): CoachFeedback[] {
  const uuid = exercises[index]?.uuid;
  return (feedback ?? []).filter((f) =>
    f.exercise_uuid ? f.exercise_uuid === uuid : f.exercise_idx === index,
  );
}

/** Where a note belongs now: its uuid says, else the position it was written at */
export function feedbackPosition(
  exercises: LoggedExercise[],
  f: Pick<CoachFeedback, "exercise_idx" | "exercise_uuid">,
): number | null {
  const byUuid = f.exercise_uuid
    ? exercises.findIndex((e) => e.uuid === f.exercise_uuid)
    : -1;
  const at = byUuid >= 0 ? byUuid : f.exercise_idx;
  return at != null && at >= 0 ? at : null;
}

/** My exercise notes by position, as the editors start */
export function exerciseNoteDrafts(
  exercises: LoggedExercise[],
  feedback: CoachFeedback[] | null | undefined,
  myId: number,
): Record<number, string> {
  const drafts: Record<number, string> = {};
  for (const f of feedback ?? []) {
    if (f.trainer_id !== myId) continue;
    if (f.exercise_idx == null && !f.exercise_uuid) continue;
    const at = feedbackPosition(exercises, f);
    if (at !== null) drafts[at] = f.note;
  }
  return drafts;
}
