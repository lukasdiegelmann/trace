import { describe, expect, it, vi } from "vitest";

import type {
  CoachMessage,
  MessagePayload,
} from "@/features/training/coaching/api";

import { createOutbox, isRetryable } from "./coachingOutbox";

const refused = (status: number, message = "no") =>
  Object.assign(new Error(message), { status });

let serverId = 0;
const stored = (payload: MessagePayload): CoachMessage => ({
  id: ++serverId,
  uuid: payload.uuid,
  pairing_id: 1,
  sender_id: 1,
  body: payload.body,
  image: payload.image ? "/api/coaching/photos/x.jpg" : null,
  read_at: null,
  created_at: "2026-03-01 10:00:00",
  updated_at: "2026-03-01 10:00:00",
  deleted_at: null,
});

function setup() {
  const send = vi.fn((_path: string, payload: MessagePayload) =>
    Promise.resolve(stored(payload)),
  );
  const remove = vi.fn((uuid: string) =>
    Promise.resolve({
      ...stored({ uuid, body: null }),
      deleted_at: "2026-03-01 11:00:00",
    }),
  );
  const outbox = createOutbox({ send, remove });
  const write = (body = "hello", image: string | null = null) =>
    outbox.enqueue({
      pairingId: 1,
      senderId: 1,
      postPath: "/coaching/pairings/1/messages",
      body,
      image,
    });
  return { outbox, send, remove, write };
}

describe("outbox", () => {
  it("waits on no connection, 5xx, 401, 408 and 429 only", () => {
    expect(isRetryable(new TypeError("Failed to fetch"))).toBe(true);
    for (const status of [500, 503, 401, 408, 429]) {
      expect(isRetryable(refused(status))).toBe(true);
    }
    for (const status of [400, 403, 404, 409]) {
      expect(isRetryable(refused(status))).toBe(false);
    }
  });

  it("limits: 4000 goes, 4001 and whitespace alone don't", () => {
    const { outbox, write } = setup();
    expect(() => write("a".repeat(4001))).toThrow(RangeError);
    expect(() => write("  \n ")).toThrow(RangeError);
    expect(write("a".repeat(4000)).body).toHaveLength(4000);
    expect(write("", "data:image/jpeg;base64,AA").body).toBeNull();
    expect(outbox.list(1)).toHaveLength(2);
  });

  it("shows a message at once, then as the server stored it", async () => {
    const { outbox, send, write } = setup();
    const row = write("hello  \n");
    expect(outbox.list(1)[0]?.syncStatus).toBe("pending");
    await expect(outbox.flush()).resolves.toEqual({
      sent: 1,
      isOffline: false,
    });
    expect(send).toHaveBeenCalledWith("/coaching/pairings/1/messages", {
      uuid: row.uuid,
      body: "hello",
      image: undefined,
    });
    expect(outbox.list(1)[0]?.syncStatus).toBe("synced");
  });

  it("keeps waiting without a connection and sends the same uuid later", async () => {
    const { outbox, send, write } = setup();
    send.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    write("one");
    write("two");
    await expect(outbox.flush()).resolves.toEqual({
      sent: 0,
      isOffline: true,
    });
    // It stops at the first sign of no connection.
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox.waiting()).toHaveLength(2);
    await outbox.flush();
    expect(send.mock.calls[1]?.[1].uuid).toBe(send.mock.calls[0]?.[1].uuid);
    expect(outbox.waiting()).toHaveLength(0);
  });

  it("marks a refused message failed, goes on, and can try it again", async () => {
    const { outbox, send, write } = setup();
    send.mockRejectedValueOnce(refused(403, "This conversation is closed."));
    const first = write("one");
    write("two");
    await outbox.flush();
    const failed = outbox.list(1).find((m) => m.uuid === first.uuid);
    expect(failed?.syncStatus).toBe("failed");
    expect(failed?.error).toBe("This conversation is closed.");
    expect(send).toHaveBeenCalledTimes(2);
    await outbox.retry(first.uuid);
    expect(outbox.list(1).every((m) => m.syncStatus === "synced")).toBe(true);
  });

  it("removes a failed message that is deleted without asking the server", async () => {
    const { outbox, send, remove, write } = setup();
    send.mockRejectedValueOnce(refused(400));
    const row = write();
    await outbox.flush();
    outbox.deleteOwn(row.uuid);
    await outbox.flush();
    expect(outbox.list(1)).toHaveLength(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it("forgets a waiting delete the server never heard of", async () => {
    const { outbox, send, remove, write } = setup();
    const row = write();
    outbox.deleteOwn(row.uuid);
    expect(outbox.list(1)[0]?.syncStatus).toBe("pending_delete");
    remove.mockRejectedValueOnce(refused(404));
    await outbox.flush();
    expect(outbox.list(1)).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("lets a delete follow a message that is on its way", async () => {
    const { outbox, send, remove, write } = setup();
    let arrive: (() => void) | undefined;
    send.mockImplementationOnce(
      (_path, payload) =>
        new Promise((resolve) => {
          arrive = () => {
            resolve(stored(payload));
          };
        }),
    );
    const row = write();
    const run = outbox.flush();
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalled();
    });
    outbox.deleteOwn(row.uuid);
    void outbox.flush();
    // An older copy from a check doesn't bring it back.
    outbox.merge([stored({ uuid: row.uuid, body: "hello" })]);
    arrive?.();
    await run;
    expect(remove).toHaveBeenCalledWith(row.uuid);
    expect(outbox.list(1)[0]?.deleted_at).toBeTruthy();
    expect(outbox.list(1)[0]?.syncStatus).toBe("synced");
  });

  it("merges by uuid, oldest first, and names deleted photos", () => {
    const { outbox } = setup();
    const a = stored({
      uuid: "aaaaaaaa",
      body: "a",
      image: "data:image/png;base64,AA",
    });
    const b = {
      ...stored({ uuid: "bbbbbbbb", body: "b" }),
      created_at: "2026-02-01 10:00:00",
    };
    outbox.merge([a, b]);
    outbox.merge([a]);
    expect(outbox.list(1).map((m) => m.uuid)).toEqual(["bbbbbbbb", "aaaaaaaa"]);
    expect(
      outbox.merge([{ ...a, image: null, body: null, deleted_at: "x" }]),
    ).toEqual(["/api/coaching/photos/x.jpg"]);
  });

  it("drops unreadable conversations but nothing that still waits", () => {
    const { outbox, write } = setup();
    outbox.merge([stored({ uuid: "aaaaaaaa", body: "a" })]);
    outbox.setCursor(1, "2026-01-01T00:00:00Z");
    write("waiting");
    outbox.keep([]);
    expect(outbox.list(1).map((m) => m.body)).toEqual(["waiting"]);
    expect(outbox.cursor(1)).toBeNull();
  });

  it("drops everything on clear, answers still on their way included", async () => {
    const { outbox, write } = setup();
    write();
    const run = outbox.flush();
    outbox.clear();
    await run;
    expect(outbox.list(1)).toHaveLength(0);
  });
});
