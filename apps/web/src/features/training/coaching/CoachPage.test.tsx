import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api";

import { coachingStore } from "./coachingStore";
import { coachingState, mockApi, renderCoaching } from "./testing";

const coach = { id: 9, name: "Kim" };
const pairing = {
  id: 4,
  status: "active",
  coach,
  note: null,
  requested_at: "2026-01-01 10:00:00",
  responded_at: "2026-01-02 10:00:00",
  unread: 0,
};
const request = {
  id: 8,
  coach: { id: 7, name: "Ana" },
  note: "Hi there",
  requested_at: "2026-02-01 10:00:00",
};
const message = (patch: object) => ({
  id: 1,
  uuid: "aaaaaaaa",
  pairing_id: 4,
  sender_id: 9,
  body: "How was leg day?",
  image: null,
  read_at: "2026-03-01 10:00:00",
  created_at: "2026-03-01 10:00:00",
  updated_at: "2026-03-01 10:00:00",
  deleted_at: null,
  ...patch,
});
const conversation = (messages: object[] = [], canSend = true) => ({
  pairing_id: 4,
  status: "active",
  can_send: canSend,
  messages,
  server_time: "2026-03-02T10:00:00.000Z",
});

afterEach(() => {
  coachingStore.reset();
  vi.restoreAllMocks();
});

describe("CoachPage", () => {
  it("accepts a request", async () => {
    const after = coachingState({
      as_client: { ...pairing, id: 8, coach: request.coach },
    });
    const calls = mockApi({
      "GET /coaching/state": coachingState({ requests: [request] }),
      "POST /coaching/pairings/8/accept": after,
      "GET /coaching/pairings/8/messages": conversation(),
    });
    await renderCoaching("/training/coach");

    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^accept$/i }));

    expect(await screen.findByText("Your coach")).toBeInTheDocument();
    expect(calls.post).toHaveBeenCalledWith("/coaching/pairings/8/accept", {});
    expect(
      await screen.findByText("No messages yet. Say hello to Ana."),
    ).toBeInTheDocument();
  });

  it("blocks Accept while there is a coach, and leaves after a confirm", async () => {
    let current = coachingState({ as_client: pairing, requests: [request] });
    const calls = mockApi({
      "GET /coaching/state": () => current,
      "GET /coaching/pairings/4/messages": conversation([message({})]),
      "POST /coaching/pairings/4/end": () => {
        current = coachingState();
        return current;
      },
    });
    await renderCoaching("/training/coach");

    expect(await screen.findByText("How was leg day?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You can have one coach at a time. Leave Kim before you accept Ana.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^accept$/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: /leave coach/i }));
    const dialog = await screen.findByRole("dialog", { name: "Leave Kim?" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: /leave coach/i }),
    );

    // Nothing left to show: back to Programs.
    expect(await screen.findByText("programs screen")).toBeInTheDocument();
    expect(calls.post).toHaveBeenCalledWith("/coaching/pairings/4/end", {});
  });

  it("shows a message at once and offers to retry a refused one", async () => {
    let attempts = 0;
    const calls = mockApi({
      "GET /coaching/state": coachingState({ as_client: pairing }),
      "GET /coaching/pairings/4/messages": conversation(),
      "POST /coaching/pairings/4/messages": (body: unknown) => {
        const sent = body as { uuid: string; body: string };
        if (++attempts === 1) {
          throw new ApiError("lt", 400, { error: "nope" });
        }
        return message({ uuid: sent.uuid, body: sent.body, sender_id: 1 });
      },
    });
    await renderCoaching("/training/coach");

    const field = await screen.findByRole("textbox", { name: "Message Kim" });
    await userEvent.type(field, "All good{Enter}");

    expect(await screen.findByText("Not sent")).toBeInTheDocument();
    expect(field).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.queryByText("Not sent")).not.toBeInTheDocument();
    });
    expect(screen.getByText("All good")).toBeInTheDocument();
    const [first, second] = calls.post.mock.calls.filter(
      ([path]) => path === "/coaching/pairings/4/messages",
    );
    expect(second[1]).toEqual(first[1]);
  });

  it("says a message waits while there is no connection", async () => {
    mockApi({
      "GET /coaching/state": coachingState({ as_client: pairing }),
      "GET /coaching/pairings/4/messages": conversation(),
      "POST /coaching/pairings/4/messages": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await renderCoaching("/training/coach");

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Message Kim" }),
      "Later{Enter}",
    );

    expect(
      await screen.findByText("Waiting for a connection"),
    ).toBeInTheDocument();
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("keeps a past conversation readable, without a composer", async () => {
    mockApi({
      "GET /coaching/state": coachingState({
        past: [
          { id: 4, coach, ended_at: "2026-02-10 10:00:00", unread: 0 },
          { id: 3, coach: request.coach, ended_at: null, unread: 2 },
        ],
      }),
      "GET /coaching/pairings/4/messages": conversation(
        [message({ body: null, deleted_at: "x" })],
        false,
      ),
    });
    await renderCoaching("/training/coach");

    expect(await screen.findByText("Message deleted")).toBeInTheDocument();
    expect(screen.getByText("Ana (2 unread)")).toBeInTheDocument();
    expect(screen.getByText(/This coaching has ended/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
