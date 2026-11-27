/** The conversation's rules, after LiftTrace's lib/coach-messages.js */
import type { CoachMessage } from "@/features/training/coaching/api";

import { isoDay, serverDate } from "./coaching";

export const MESSAGE_MAX = 4000;
/** The counter shows up this close to the limit */
export const MESSAGE_COUNTER_FROM = MESSAGE_MAX - 400;

export type Conversation =
  | { side: "client"; pairingId: number }
  | { side: "coach"; pairingId: number; clientId: number };

/** The client reaches theirs by the pairing, a coach by the client */
export function conversationPath(conversation: Conversation): string {
  return conversation.side === "coach"
    ? `/coaching/clients/${conversation.clientId}/messages`
    : `/coaching/pairings/${conversation.pairingId}/messages`;
}

/** The text as it goes: no trailing whitespace */
export function trimMessage(body: string): string {
  return body.replace(/\s+$/, "");
}

/** The server stores a uuid once: ^[A-Za-z0-9-]{8,64}$ */
export function newMessageId(): string {
  // Only secure contexts have randomUUID.
  if ("randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** "YYYY-MM-DD HH:MM:SS" in UTC, as the server writes it */
export function sqlNow(now: Date = new Date()): string {
  return now.toISOString().replace("T", " ").slice(0, 19);
}

/** The newest of my messages the other person has read: "Read" goes there */
export function lastReadUuid(
  messages: CoachMessage[],
  myId: number,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.sender_id === myId && m.read_at && !m.deleted_at) return m.uuid;
  }
  return null;
}

export function hasUnreadFromOther(
  messages: CoachMessage[],
  myId: number,
): boolean {
  return messages.some(
    (m) => m.sender_id !== myId && !m.read_at && !m.deleted_at,
  );
}

export interface DayRow<M> {
  message: M;
  /** The local day, YYYY-MM-DD */
  day: string;
  /** A day separator goes above it */
  isNewDay: boolean;
}

export function withDays<M extends { created_at: string }>(
  messages: M[],
): DayRow<M>[] {
  let previous = "";
  return messages.map((message) => {
    const date = serverDate(message.created_at);
    const day = Number.isNaN(date.getTime()) ? "" : isoDay(date);
    const isNewDay = day !== previous;
    previous = day;
    return { message, day, isNewDay };
  });
}
