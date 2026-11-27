import { describe, expect, it } from "vitest";

import type { CoachMessage } from "@/features/training/coaching/api";

import {
  conversationPath,
  hasUnreadFromOther,
  lastReadUuid,
  newMessageId,
  trimMessage,
  withDays,
} from "./coachingMessages";

const message = (patch: Partial<CoachMessage>): CoachMessage => ({
  id: 1,
  uuid: "u1",
  pairing_id: 1,
  sender_id: 1,
  body: "hi",
  image: null,
  read_at: null,
  created_at: "2026-03-01 10:00:00",
  updated_at: "2026-03-01 10:00:00",
  deleted_at: null,
  ...patch,
});

describe("conversation rules", () => {
  it("reaches a conversation by pairing or by client", () => {
    expect(conversationPath({ side: "client", pairingId: 4 })).toBe(
      "/coaching/pairings/4/messages",
    );
    expect(conversationPath({ side: "coach", pairingId: 4, clientId: 7 })).toBe(
      "/coaching/clients/7/messages",
    );
  });

  it("trims the end only and makes ids the server takes", () => {
    expect(trimMessage("  a \n\n")).toBe("  a");
    expect(newMessageId()).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("puts Read on my newest read message that is still there", () => {
    const messages = [
      message({ uuid: "a", read_at: "x" }),
      message({ uuid: "b", read_at: "x" }),
      message({ uuid: "c", read_at: "x", deleted_at: "x" }),
      message({ uuid: "d" }),
      message({ uuid: "e", sender_id: 2, read_at: "x" }),
    ];
    expect(lastReadUuid(messages, 1)).toBe("b");
    expect(lastReadUuid([], 1)).toBeNull();
    expect(hasUnreadFromOther(messages, 1)).toBe(false);
    expect(hasUnreadFromOther([message({ sender_id: 2 })], 1)).toBe(true);
  });

  it("starts a new day where the day changes", () => {
    const rows = withDays([
      message({ created_at: "2026-03-01 11:00:00" }),
      message({ created_at: "2026-03-01 12:00:00" }),
      message({ created_at: "2026-03-03 12:00:00" }),
    ]);
    expect(rows.map((r) => r.isNewDay)).toEqual([true, false, true]);
    expect(rows[2]?.day).toBe("2026-03-03");
  });
});
