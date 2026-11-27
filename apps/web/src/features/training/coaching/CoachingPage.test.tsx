import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { coachingStore } from "./coachingStore";
import { coachingState, ME, mockApi, renderCoaching } from "./testing";

const trainer = coachingState({
  role: "trainer",
  can_coach: true,
  as_coach: { pending: 1, active: 1, recent: 0, active_ids: [], unread: 0 },
});
const member = {
  id: 3,
  username: "jo",
  full_name: "Jo Client",
  nickname: null,
  avatar_url: null,
  role: "member",
  pairing_id: 4,
  coached_since: null,
  active_program: "Push Pull",
  last_workout_date: null,
  week_count: 2,
  unread: 1,
};
const activity = {
  id: 11,
  member_id: 3,
  kind: "feedback_reply",
  workout_id: 20,
  occurred_at: "2026-03-01 10:00:00",
  seen_at: null,
  member_full_name: "Jo Client",
  member_username: "jo",
  member_nickname: null,
  prescription_date: null,
  prescription_name: null,
  template_name: null,
  program_name: null,
  feedback_reply_text: "Will do",
  workout_date: "2026-03-01",
};
const overview = {
  user: member,
  pairing_id: null,
  coached_since: null,
  active_program: { id: 1, name: "Push Pull", goal: "strength" },
  assigned_programs: [
    { id: 1, name: "Push Pull", goal: "strength", active: 1 },
    { id: 2, name: "Legs", goal: null, active: 0 },
  ],
  recent_workouts: [
    {
      id: 20,
      date: "2026-03-01",
      name: "Push day",
      completed: 1,
      duration_min: 55,
      feedback_count: 1,
      my_feedback_count: 1,
      my_reply_count: 1,
      volume: 500,
      set_count: 1,
      exercise_count: 1,
    },
  ],
  streak: 3,
  weight_unit: "kg",
};
const workout = {
  id: 20,
  date: "2026-03-01",
  name: "Push day",
  notes: "Felt strong",
  duration_min: 55,
  exercises: [
    {
      uuid: "ex-1",
      exercise_name: "Bench Press",
      sets: [
        { uuid: "s1", completed: true, weight: 100, reps: 5, rpe: 8 },
        { uuid: "s2", completed: false, weight: 100, reps: 5 },
      ],
    },
  ],
  feedback: [
    {
      id: 1,
      trainer_id: ME,
      exercise_idx: null,
      exercise_uuid: null,
      note: "Nice session",
      updated_at: null,
      member_reply: "Will do",
      member_replied_at: null,
      seen_by_member_at: null,
      trainer_name: "Me",
      trainer_avatar_url: null,
    },
  ],
};
const prescriptions = [
  {
    id: 5,
    date: "2000-01-01",
    template_id: 1,
    name: null,
    notes: "Slow",
    template_name: "Push A",
    program_name: "Push Pull",
    completed: 0,
    status: "accepted",
    responded_at: "x",
  },
];
const routes = {
  "GET /coaching/state": trainer,
  "GET /coaching/requests": [
    {
      id: 30,
      status: "pending",
      client: { id: 6, name: "Pat" },
      note: null,
      requested_at: "",
      responded_at: null,
      ended_at: null,
    },
  ],
  "GET /trainer/members": [member],
  "GET /trainer/activity": [activity],
  "POST /trainer/activity/seen": { ok: true },
  "GET /trainer/members/3": overview,
  "GET /trainer/members/3/prescriptions": prescriptions,
  "GET /trainer/members/3/workout/2026-03-01": workout,
  "GET /set-media": {
    media: [
      {
        id: 41,
        workout_id: 20,
        exercise_uuid: "ex-1",
        set_uuid: "s1",
        file_url: "/api/set-media/41/file",
      },
    ],
  },
  "POST /trainer/feedback": { ok: true },
};

afterEach(() => {
  coachingStore.reset();
  vi.restoreAllMocks();
});

describe("CoachingPage", () => {
  it("lists activity, requests and clients", async () => {
    const calls = mockApi({
      ...routes,
      "POST /coaching/pairings/30/end": trainer,
    });
    await renderCoaching("/training/coaching");

    expect(await screen.findByText("Push Pull")).toBeInTheDocument();
    expect(await screen.findByText("Pat")).toBeInTheDocument();
    expect(screen.getByText("replied: “Will do”")).toBeInTheDocument();
    // One unseen activity row plus one unread message.
    expect(
      screen.getByRole("status", { name: "2 unread" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Last: never")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /cancel request/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /cancel request/i }),
    );
    await waitFor(() => {
      expect(calls.post).toHaveBeenCalledWith("/coaching/pairings/30/end", {
        expect: "pending",
      });
    });
  });

  it("says when there are no clients yet", async () => {
    mockApi({
      "GET /coaching/state": coachingState({ role: "trainer" }),
      "GET /trainer/members": [],
      "GET /trainer/activity": [],
    });
    await renderCoaching("/training/coaching");

    expect(await screen.findByText("No clients yet")).toBeInTheDocument();
  });

  it("sends a request found by an accent-folded search", async () => {
    const calls = mockApi({
      "GET /coaching/state": coachingState({ role: "trainer" }),
      "GET /trainer/members": [],
      "GET /trainer/activity": [],
      "GET /trainer/unassigned-members": [
        { id: 6, name: "Zoë" },
        { id: 7, name: "Max" },
      ],
      "POST /trainer/members/6": { ok: true, status: "pending", id: 1 },
    });
    await renderCoaching("/training/coaching");

    await userEvent.click(
      await screen.findByRole("button", { name: /add client/i }),
    );
    await screen.findByRole("button", { name: /max/i });
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search people" }),
      "zoe",
    );
    expect(
      screen.queryByRole("button", { name: /max/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /zoë/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /send request to zoë/i }),
    );

    expect(await screen.findByText("Request sent to Zoë")).toBeInTheDocument();
    expect(calls.post).toHaveBeenCalledWith("/trainer/members/6", {});
  });

  it("opens the replied workout from the activity feed", async () => {
    const calls = mockApi(routes);
    const router = await renderCoaching("/training/coaching");

    await userEvent.click(
      await screen.findByRole("button", { name: /replied: “will do”/i }),
    );

    const sheet = await screen.findByRole("dialog", { name: "Push day" });
    expect(await within(sheet).findByText("Bench Press")).toBeInTheDocument();
    expect(within(sheet).getByText("100 kg × 5")).toBeInTheDocument();
    expect(within(sheet).getByText("1 set")).toBeInTheDocument();
    expect(within(sheet).getByText("Jo Client replied")).toBeInTheDocument();
    expect(calls.post).toHaveBeenCalledWith("/trainer/activity/seen", {
      id: 11,
    });
    // The deep link is used once.
    await waitFor(() => {
      expect(router.state.location.state).toBeNull();
    });
  });

  it("shows a client and saves a note on an exercise", async () => {
    const calls = mockApi(routes);
    await renderCoaching("/training/coaching/3");

    expect(
      await screen.findByRole("heading", { name: "Jo Client" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Push A · Push Pull")).toBeInTheDocument();
    expect(screen.getByText("Missed")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Make Legs active" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /push day/i }));
    const sheet = await screen.findByRole("dialog", { name: "Push day" });
    expect(
      await within(sheet).findByRole("button", { name: /^watch$/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(sheet).getByRole("button", {
        name: /add a note on this exercise/i,
      }),
    );
    await userEvent.type(
      within(sheet).getByRole("textbox", { name: "Note on Bench Press…" }),
      "Elbows in",
    );
    await userEvent.click(
      within(sheet).getByRole("button", { name: /^save$/i }),
    );

    await waitFor(() => {
      expect(calls.post).toHaveBeenCalledWith("/trainer/feedback", {
        workout_id: 20,
        exercise_idx: 0,
        exercise_uuid: "ex-1",
        note: "Elbows in",
      });
    });
    expect(await screen.findByText("Note saved")).toBeInTheDocument();
  });

  it("stamps a note on a set video and removes a note after a confirm", async () => {
    const calls = mockApi(routes);
    await renderCoaching("/training/coaching/3");
    await userEvent.click(
      await screen.findByRole("button", { name: /push day/i }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /^watch$/i }),
    );
    const player = await screen.findByRole("dialog", { name: "Set video" });
    const video = within(player).getByLabelText("Set video: Bench Press");
    expect(video).toHaveAttribute("src", "/lt/api/set-media/41/file");
    Object.defineProperty(video, "currentTime", { value: 12.4 });
    await userEvent.click(
      within(player).getByRole("button", { name: /stamp it/i }),
    );
    expect(
      within(player).getByRole("button", { name: /note at 0:12/i }),
    ).toBeInTheDocument();
    await userEvent.type(
      within(player).getByRole("textbox", { name: "Note on this clip" }),
      "Knees",
    );
    await userEvent.click(
      within(player).getByRole("button", { name: /save note/i }),
    );
    await waitFor(() => {
      expect(calls.post).toHaveBeenCalledWith("/trainer/feedback", {
        workout_id: 20,
        exercise_idx: 0,
        exercise_uuid: "ex-1",
        note: "Knees",
        media_id: 41,
        media_time_sec: 12.4,
      });
    });

    const sheet = await screen.findByRole("dialog", { name: "Push day" });
    await userEvent.click(
      within(sheet).getByRole("button", { name: /^delete$/i }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Delete this note?",
    });
    await userEvent.click(
      within(confirm).getByRole("button", { name: /^delete$/i }),
    );
    await waitFor(() => {
      expect(calls.post).toHaveBeenCalledWith("/trainer/feedback", {
        workout_id: 20,
        exercise_idx: null,
        note: "",
      });
    });
  });

  it("ends coaching after a confirm and goes back to the list", async () => {
    const calls = mockApi({
      ...routes,
      "DELETE /trainer/members/3": { ok: true },
    });
    const router = await renderCoaching("/training/coaching/3");

    await userEvent.click(
      await screen.findByRole("button", { name: "End coaching" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /end coaching/i }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/training/coaching");
    });
    expect(calls.delete).toHaveBeenCalledWith("/trainer/members/3");
  });

  it("says when a client can't be loaded", async () => {
    mockApi({ "GET /coaching/state": trainer });
    await renderCoaching("/training/coaching/99");

    expect(
      await screen.findByText("Couldn't load this client."),
    ).toBeInTheDocument();
  });

  it("prescribes and assigns from their sheets", async () => {
    const calls = mockApi({
      ...routes,
      "GET /programs": [{ id: 1, name: "Push Pull" }],
      "GET /programs/1": {
        id: 1,
        name: "Push Pull",
        templates: [{ id: 12, name: "Push A" }],
      },
      "POST /programs/2/assign": { ok: true },
      "PUT /trainer/prescriptions/5": { ok: true },
    });
    await renderCoaching("/training/coaching/3");

    await userEvent.click(
      await screen.findByRole("button", { name: "Make Legs active" }),
    );
    await waitFor(() => {
      expect(calls.post).toHaveBeenCalledWith("/programs/2/assign", {
        user_id: 3,
        make_active: true,
      });
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Edit prescription Push A" }),
    );
    const sheet = await screen.findByRole("dialog", {
      name: "Edit prescription",
    });
    await userEvent.click(
      within(sheet).getByRole("button", { name: /^save$/i }),
    );
    await waitFor(() => {
      expect(calls.put).toHaveBeenCalledWith("/trainer/prescriptions/5", {
        date: "2000-01-01",
        notes: "Slow",
      });
    });

    await userEvent.click(screen.getByRole("button", { name: /prescribe/i }));
    const prescribe = await screen.findByRole("dialog", {
      name: "Prescribe a workout",
    });
    expect(
      await within(prescribe).findByText("— choose a workout —"),
    ).toBeInTheDocument();
    expect(
      within(prescribe).getByRole("button", { name: /^prescribe$/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
