import { describe, expect, it } from "vitest";

import type {
  CoachActivity,
  CoachFeedback,
  CoachingState,
  LoggedExercise,
  SetClip,
} from "@/features/training/coaching/api";

import {
  activityRelative,
  activityText,
  clientsUnread,
  clipsByExercise,
  clipSetNumber,
  coachingSignature,
  coachUnread,
  exerciseNoteDrafts,
  feedbackForExercise,
  formatDay,
  inCoachingNow,
  isoDay,
  localDay,
  markSeen,
  memberBadge,
  memberLabel,
  pickerName,
  prescriptionChips,
  readableConversationIds,
  relativeDay,
  serverDate,
  showsBadge,
  showsCoachingTab,
  showsCoachTab,
  truncateReply,
  unreadByMember,
  videoClock,
  workoutLevelFeedback,
} from "./coaching";
import { calcVolume } from "./workout";

const state = (patch: Partial<CoachingState> = {}): CoachingState => ({
  role: "member",
  can_coach: false,
  as_client: null,
  requests: [],
  past: [],
  as_coach: { pending: 0, active: 0, recent: 0 },
  unread: 0,
  awaiting: 0,
  ...patch,
});
const coach = { id: 9, name: "Kim" };
const pairing = {
  id: 4,
  status: "active",
  coach,
  note: null,
  requested_at: "2026-01-01 10:00:00",
  responded_at: null,
  unread: 2,
};

describe("who sees what", () => {
  it("shows nothing without a state", () => {
    expect(showsCoachTab(null)).toBe(false);
    expect(showsCoachingTab(null)).toBe(false);
    expect(showsBadge(null)).toBe(false);
    expect(inCoachingNow(null)).toBe(false);
  });

  it("gives the Coach screen for a past conversation alone", () => {
    const s = state({ past: [{ id: 1, coach, ended_at: null, unread: 3 }] });
    expect(showsCoachTab(s)).toBe(true);
    expect(coachUnread(s)).toBe(3);
  });

  it("counts a trainer as in coaching, an admin only with clients", () => {
    expect(inCoachingNow(state({ role: "trainer" }))).toBe(true);
    expect(inCoachingNow(state({ role: "admin" }))).toBe(false);
    expect(
      inCoachingNow(
        state({
          role: "admin",
          as_coach: { pending: 0, active: 0, recent: 1 },
        }),
      ),
    ).toBe(true);
    expect(showsCoachingTab(state({ role: "admin" }))).toBe(true);
    expect(showsCoachingTab(state())).toBe(false);
  });

  it("marks the badge for something waiting", () => {
    expect(showsBadge(state({ awaiting: 1 }))).toBe(true);
    expect(showsBadge(state({ unread: 1 }))).toBe(true);
    expect(showsBadge(state())).toBe(false);
  });

  it("adds up unread per side and lists readable conversations", () => {
    const s = state({
      as_client: pairing,
      past: [{ id: 2, coach, ended_at: null, unread: 1 }],
      as_coach: {
        pending: 0,
        active: 2,
        recent: 0,
        active_ids: [7, 8],
        unread: 5,
      },
    });
    expect(coachUnread(s)).toBe(3);
    expect(clientsUnread(s)).toBe(5);
    expect(readableConversationIds(s)).toEqual([4, 2, 7, 8]);
  });
});

describe("coachingSignature", () => {
  it("has the server's format", () => {
    expect(
      coachingSignature(
        state({
          as_client: pairing,
          requests: [
            { id: 5, coach, note: null, requested_at: "" },
            { id: 6, coach, note: null, requested_at: "" },
          ],
          past: [{ id: 2, coach, ended_at: null, unread: 0 }],
          as_coach: { pending: 1, active: 3, recent: 0 },
          unread: 2,
          awaiting: 4,
        }),
      ),
    ).toBe("member;4;5,6;1.3;2;2;4");
  });

  it("puts - for empty parts", () => {
    expect(coachingSignature(state({ role: null }))).toBe("-;-;-;0.0;-;0;0");
    expect(coachingSignature(null)).toBeNull();
  });
});

describe("dates", () => {
  it("reads a server timestamp as UTC", () => {
    expect(serverDate("2026-03-01 12:00:00").toISOString()).toBe(
      "2026-03-01T12:00:00.000Z",
    );
    expect(serverDate("2026-03-01T12:00:00+01:00").toISOString()).toBe(
      "2026-03-01T11:00:00.000Z",
    );
  });

  it("formats a day after the settings and leaves nonsense as it is", () => {
    expect(formatDay("2026-03-09", "US")).toBe("03/09/2026");
    expect(formatDay("2026-03-09", "EU")).toBe("09/03/2026");
    expect(formatDay("2026-03-09", "ISO")).toBe("2026-03-09");
    expect(formatDay("soon", "EU")).toBe("soon");
    expect(formatDay(null, "EU")).toBe("");
    expect(localDay("2026-03-09 12:00:00")).toBe("2026-03-09");
    expect(localDay("nope")).toBeNull();
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-03-10T12:00:00Z");
    expect(activityRelative("2026-03-10 11:59:30", now)).toEqual({
      unit: "justNow",
    });
    expect(activityRelative("2026-03-10 11:55:00", now)).toEqual({
      unit: "minutes",
      n: 5,
    });
    expect(activityRelative("2026-03-10 09:00:00", now)).toEqual({
      unit: "hours",
      n: 3,
    });
    expect(activityRelative("2026-03-07 12:00:00", now)).toEqual({
      unit: "days",
      n: 3,
    });
    expect(activityRelative("2026-03-01 12:00:00", now)?.unit).toBe("date");
    expect(activityRelative(null, now)).toBeNull();
  });

  it("says how long ago a workout's day was", () => {
    const now = new Date(2026, 2, 30, 23, 0);
    expect(relativeDay(null, now)).toEqual({ unit: "never" });
    expect(relativeDay("2026-03-30", now)).toEqual({ unit: "today" });
    expect(relativeDay("2026-03-31", now)).toEqual({ unit: "today" });
    expect(relativeDay("2026-03-29", now)).toEqual({ unit: "yesterday" });
    expect(relativeDay("2026-03-26", now)).toEqual({ unit: "days", n: 4 });
    expect(relativeDay("2026-03-16", now)).toEqual({ unit: "weeks", n: 2 });
    expect(relativeDay("2026-01-01", now).unit).toBe("date");
    expect(isoDay(now)).toBe("2026-03-30");
  });
});

const row = (patch: Partial<CoachActivity>): CoachActivity => ({
  id: 1,
  member_id: 3,
  kind: "prescription_completed",
  workout_id: null,
  occurred_at: null,
  seen_at: null,
  member_full_name: null,
  member_username: null,
  member_nickname: null,
  prescription_date: null,
  prescription_name: null,
  template_name: null,
  program_name: null,
  feedback_reply_text: null,
  workout_date: null,
  ...patch,
});

describe("people and activity", () => {
  it("names people", () => {
    expect(memberLabel({ nickname: "Jo", username: "jo1" })).toBe("Jo");
    expect(memberLabel(null)).toBe("?");
    expect(pickerName({ id: 1, name: "Ana", full_name: "x" })).toBe("Ana");
    expect(pickerName({ id: 1, username: "ana" })).toBe("ana");
  });

  it("describes a feed row", () => {
    expect(activityText(row({ template_name: "Push" }))).toEqual({
      type: "completed",
      workout: "Push",
    });
    expect(
      activityText(
        row({ kind: "prescription_missed", prescription_date: "2026-01-02" }),
      ),
    ).toEqual({ type: "missed", workout: null, date: "2026-01-02" });
    expect(activityText(row({ kind: "feedback_reply" }))).toEqual({
      type: "repliedNote",
    });
    expect(activityText(row({ kind: "other_kind" }))).toEqual({
      type: "other",
      kind: "other_kind",
    });
  });

  it("cuts a long reply to 80 characters ending in …", () => {
    const cut = truncateReply("a".repeat(100));
    expect(cut).toHaveLength(80);
    expect(cut.endsWith("…")).toBe(true);
    expect(truncateReply("a".repeat(80))).toHaveLength(80);
    expect(truncateReply("a".repeat(80)).endsWith("…")).toBe(false);
  });

  it("counts unseen activity per client and marks it seen", () => {
    const rows = [
      row({ id: 1 }),
      row({ id: 2 }),
      row({ id: 3, member_id: 4, seen_at: "x" }),
    ];
    expect(unreadByMember(rows)).toEqual({ 3: 2 });
    expect(memberBadge({ id: 3, unread: 1 }, unreadByMember(rows))).toBe(3);
    expect(unreadByMember(markSeen(rows, 1, "now"))).toEqual({ 3: 1 });
    expect(unreadByMember(markSeen(rows, undefined, "now"))).toEqual({});
    expect(markSeen(rows, undefined, "now")[2]?.seen_at).toBe("x");
  });
});

describe("prescription chips", () => {
  const base = {
    status: "accepted" as const,
    responded_at: "x",
    completed: 0,
    date: "2026-03-01",
  };

  it("marks a past, accepted one as accepted and missed", () => {
    expect(prescriptionChips(base, "2026-03-02")).toEqual([
      "accepted",
      "missed",
    ]);
    expect(prescriptionChips(base, "2026-03-01")).toEqual(["accepted"]);
  });

  it("never reports a declined one as missed", () => {
    expect(
      prescriptionChips({ ...base, status: "declined" }, "2026-03-02"),
    ).toEqual(["declined"]);
  });

  it("shows waiting and completed, and nothing missed without a day", () => {
    expect(
      prescriptionChips(
        { status: "pending", responded_at: null, completed: null, date: null },
        "2026-03-02",
      ),
    ).toEqual(["waiting"]);
    expect(prescriptionChips({ ...base, completed: 1 }, "2026-03-02")).toEqual([
      "completed",
    ]);
  });
});

describe("set videos", () => {
  const clip = (id: number, set: string): SetClip => ({
    id,
    workout_id: 1,
    exercise_uuid: "e1",
    set_uuid: set,
    duration_sec: null,
    mime: null,
    file_url: `/api/set-media/${id}/file`,
  });

  it("keeps every clip on an exercise, oldest first", () => {
    // The server sends newest first.
    const map = clipsByExercise([clip(2, "s2"), clip(1, "s1")]);
    expect(map.get("e1")?.map((c) => c.id)).toEqual([1, 2]);
    expect(map.size).toBe(1);
    expect(
      clipsByExercise([{ ...clip(3, "s"), exercise_uuid: null }]).size,
    ).toBe(0);
  });

  it("numbers the set a clip is on, or none when it is gone", () => {
    const exercise = { sets: [{ uuid: "s1" }, { uuid: "s2" }] };
    expect(clipSetNumber(exercise, clip(1, "s2"))).toBe(2);
    expect(clipSetNumber(exercise, clip(1, "gone"))).toBeNull();
  });

  it("writes a position as m:ss", () => {
    expect(videoClock(0)).toBe("0:00");
    expect(videoClock(75.9)).toBe("1:15");
  });
});

describe("notes on a workout", () => {
  const note = (patch: Partial<CoachFeedback>): CoachFeedback => ({
    id: 1,
    trainer_id: 9,
    exercise_idx: 0,
    exercise_uuid: null,
    note: "n",
    updated_at: null,
    member_reply: null,
    member_replied_at: null,
    seen_by_member_at: null,
    trainer_name: null,
    trainer_avatar_url: null,
    ...patch,
  });

  it("keeps each note on its own lift when the session was reordered", () => {
    // Written when the squat was first.
    const reordered: LoggedExercise[] = [{ uuid: "bench" }, { uuid: "squat" }];
    const feedback = [
      note({ id: 1, exercise_idx: 0, exercise_uuid: "squat", note: "depth" }),
      note({ id: 2, exercise_idx: 1, exercise_uuid: "bench", note: "elbows" }),
    ];
    expect(exerciseNoteDrafts(reordered, feedback, 9)).toEqual({
      0: "elbows",
      1: "depth",
    });
    expect(
      feedbackForExercise(reordered, feedback, 1).map((f) => f.note),
    ).toEqual(["depth"]);
  });

  it("falls back to the position for notes without a uuid", () => {
    const exercises: LoggedExercise[] = [{ uuid: "a" }, { uuid: "b" }];
    const feedback = [
      note({ exercise_idx: 1, note: "old" }),
      note({ id: 2, exercise_idx: null, note: "all" }),
      note({ id: 3, trainer_id: 8, exercise_idx: 0, note: "theirs" }),
    ];
    expect(exerciseNoteDrafts(exercises, feedback, 9)).toEqual({ 1: "old" });
    expect(feedbackForExercise(exercises, feedback, 1)).toHaveLength(1);
    expect(workoutLevelFeedback(feedback).map((f) => f.note)).toEqual(["all"]);
  });

  it("adds up volume without warm-ups and timed sets, by load type", () => {
    expect(
      calcVolume([
        {
          sets: [
            { completed: true, weight: 100, reps: 5 },
            { completed: true, warmup: true, weight: 50, reps: 5 },
            { completed: false, weight: 100, reps: 5 },
            { completed: true, weight: 20, duration_sec: 60 },
          ],
        },
        {
          load_type: "unilateral",
          sets: [
            { completed: true, weight: 10, reps_l: 8, reps_r: 7 },
            { completed: true, weight: 10, reps: 5 },
          ],
        },
        {
          load_type: "paired",
          sets: [{ completed: true, weight: 10, reps: 10 }],
        },
      ]),
    ).toBe(500 + 150 + 100 + 200);
  });
});
