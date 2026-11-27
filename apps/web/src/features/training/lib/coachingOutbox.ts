/**
 * The conversations of this page, and the messages still to go, after
 * LiftTrace's lib/coach-messages.js. Kept in memory only: a message is shown
 * at once with a uuid made here and sent; one that can't go waits (or, when
 * the server refuses it, is marked failed). The server stores a uuid once, so
 * a retry after a lost answer never makes a second copy.
 */
import type {
  CoachMessage,
  MessagePayload,
} from "@/features/training/coaching/api";

import {
  MESSAGE_MAX,
  newMessageId,
  sqlNow,
  trimMessage,
} from "./coachingMessages";

export type SyncStatus = "synced" | "pending" | "failed" | "pending_delete";

export interface LocalMessage extends CoachMessage {
  syncStatus: SyncStatus;
  /** The photo as a data URL while it hasn't gone */
  imageLocal: string | null;
  postPath: string | null;
  error: string | null;
}

export interface OutboxTransport {
  send: (path: string, payload: MessagePayload) => Promise<CoachMessage>;
  remove: (uuid: string) => Promise<CoachMessage>;
}

export interface NewMessage {
  pairingId: number;
  senderId: number;
  postPath: string;
  body: string;
  image: string | null;
}

export interface FlushResult {
  sent: number;
  /** It stopped for lack of a connection (or a server having a moment) */
  isOffline: boolean;
}

function statusOf(error: unknown): number {
  return typeof error === "object" && error !== null && "status" in error
    ? Number(error.status) || 0
    : 0;
}

/** No connection, a server having a moment, a session to renew, a timeout or
 *  too many at once: the message waits. Anything else is refused for good. */
export function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  return !status || status >= 500 || [401, 408, 429].includes(status);
}

/** By time, then the server's order; what hasn't gone yet keeps the order it
 *  was written in (the sort is stable). */
function byTime(a: LocalMessage, b: LocalMessage): number {
  return (
    a.created_at.localeCompare(b.created_at) ||
    (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
  );
}

const NONE: LocalMessage[] = [];

export function createOutbox(transport: OutboxTransport) {
  const messages = new Map<string, LocalMessage>();
  /** `since` per pairing; goes with the messages it followed */
  const cursors = new Map<number, string>();
  const listeners = new Set<() => void>();
  let lists = new Map<number, LocalMessage[]>();
  let flushing: Promise<FlushResult> | null = null;
  let shouldRunAgain = false;
  /** Goes up on clear(): answers still on their way are dropped */
  let generation = 0;

  function changed(): void {
    lists = new Map();
    for (const listener of listeners) listener();
  }

  /** Oldest first; the same array until something changes */
  function list(pairingId: number): LocalMessage[] {
    let found = lists.get(pairingId);
    if (!found) {
      const mine = [...messages.values()].filter(
        (m) => m.pairing_id === pairingId,
      );
      found = mine.length ? mine.sort(byTime) : NONE;
      lists.set(pairingId, found);
    }
    return found;
  }

  function put(row: CoachMessage): void {
    const existing = messages.get(row.uuid);
    // A delete still to go isn't undone by an older copy coming back.
    if (existing?.syncStatus === "pending_delete" && !row.deleted_at) return;
    messages.set(row.uuid, {
      ...row,
      syncStatus: "synced",
      imageLocal: null,
      postPath: null,
      error: null,
    });
  }

  /** Rows from the server. Returns the photos of messages now deleted. */
  function merge(rows: CoachMessage[]): string[] {
    const gonePhotos: string[] = [];
    for (const row of rows) {
      const image = row.deleted_at ? messages.get(row.uuid)?.image : null;
      if (image) gonePhotos.push(image);
      put(row);
    }
    if (rows.length) changed();
    return gonePhotos;
  }

  function waiting(): LocalMessage[] {
    return [...messages.values()]
      .filter(
        (m) => m.syncStatus === "pending" || m.syncStatus === "pending_delete",
      )
      .sort(byTime);
  }

  async function flushOnce(): Promise<FlushResult> {
    const started = generation;
    let sent = 0;
    for (const snapshot of waiting()) {
      if (started !== generation) break;
      const m = messages.get(snapshot.uuid);
      if (!m) continue;
      try {
        if (m.syncStatus === "pending_delete") {
          const row = await transport.remove(m.uuid);
          if (started !== generation) break;
          put(row);
        } else if (m.syncStatus === "pending") {
          const row = await transport.send(m.postPath ?? "", {
            uuid: m.uuid,
            body: m.body,
            image: m.imageLocal ?? undefined,
          });
          if (started !== generation) break;
          put(row);
        } else {
          continue;
        }
        sent++;
        changed();
      } catch (error) {
        if (started !== generation) break;
        // A delete of something that never arrived: nothing to undo there.
        if (m.syncStatus === "pending_delete" && statusOf(error) === 404) {
          messages.delete(m.uuid);
          sent++;
          changed();
          continue;
        }
        if (isRetryable(error)) return { sent, isOffline: true };
        const current = messages.get(m.uuid);
        // Deleted while it was going: the delete follows on the next run.
        if (!current || current.syncStatus !== m.syncStatus) continue;
        messages.set(m.uuid, {
          ...current,
          syncStatus: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        changed();
      }
    }
    return { sent, isOffline: false };
  }

  const hasMoreToDo = () => shouldRunAgain;

  /** Sends everything waiting, oldest first, one run at a time. What is
   *  written while a run is under way goes in the same run. */
  function flush(): Promise<FlushResult> {
    if (flushing) {
      shouldRunAgain = true;
      return flushing;
    }
    const run = async (): Promise<FlushResult> => {
      let total = 0;
      for (;;) {
        shouldRunAgain = false;
        const result = await flushOnce();
        total += result.sent;
        if (result.isOffline || !hasMoreToDo()) {
          return { sent: total, isOffline: result.isOffline };
        }
      }
    };
    // The queue is read after this turn, so `flushing` is set by then.
    flushing = Promise.resolve()
      .then(run)
      .finally(() => {
        flushing = null;
      });
    return flushing;
  }

  /** Keeps a new message here as waiting; `flush` sends it */
  function enqueue(input: NewMessage): LocalMessage {
    const text = trimMessage(input.body);
    if (text.length > MESSAGE_MAX) throw new RangeError("message too long");
    if (!text.trim() && !input.image) throw new RangeError("empty message");
    const now = sqlNow();
    const row: LocalMessage = {
      id: null,
      uuid: newMessageId(),
      pairing_id: input.pairingId,
      sender_id: input.senderId,
      body: text.trim() ? text : null,
      image: null,
      imageLocal: input.image,
      postPath: input.postPath,
      read_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      error: null,
      syncStatus: "pending",
    };
    messages.set(row.uuid, row);
    changed();
    return row;
  }

  /** A message marked Not Sent, tried again */
  function retry(uuid: string): Promise<FlushResult> {
    const m = messages.get(uuid);
    if (m?.syncStatus === "failed") {
      messages.set(uuid, { ...m, syncStatus: "pending", error: null });
      changed();
    }
    return flush();
  }

  /** Deletes an own message ("Message deleted"). Returns its photo's path. */
  function deleteOwn(uuid: string): string | null {
    const m = messages.get(uuid);
    if (!m) return null;
    if (m.syncStatus === "failed" && !m.deleted_at) {
      // It never could go: just gone.
      messages.delete(uuid);
    } else {
      // Waiting ones too (it may have arrived already): the delete follows.
      messages.set(uuid, {
        ...m,
        body: null,
        image: null,
        imageLocal: null,
        deleted_at: sqlNow(),
        syncStatus: "pending_delete",
        error: null,
      });
    }
    changed();
    return m.image;
  }

  /** Drops the conversations this account may no longer read, but never what
   *  still waits to go. Returns the photos of what went. */
  function keep(pairingIds: number[]): string[] {
    const readable = new Set(pairingIds);
    const photos: string[] = [];
    let didDrop = false;
    for (const m of [...messages.values()]) {
      if (readable.has(m.pairing_id)) continue;
      if (m.syncStatus === "pending" || m.syncStatus === "pending_delete") {
        continue;
      }
      if (m.image) photos.push(m.image);
      messages.delete(m.uuid);
      didDrop = true;
    }
    for (const id of [...cursors.keys()]) {
      if (!readable.has(id)) cursors.delete(id);
    }
    if (didDrop) changed();
    return photos;
  }

  return {
    list,
    merge,
    enqueue,
    flush,
    retry,
    deleteOwn,
    keep,
    waiting,
    cursor: (pairingId: number) => cursors.get(pairingId) ?? null,
    setCursor: (pairingId: number, since: string) => {
      cursors.set(pairingId, since);
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Another account: nothing of the old one stays or goes out */
    clear(): void {
      generation++;
      messages.clear();
      cursors.clear();
      shouldRunAgain = false;
      changed();
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;
