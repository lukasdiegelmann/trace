/**
 * Where the signed-in person stands in coaching (GET /coaching/state), kept
 * for the whole app: the training navigation and both screens read it.
 */
import {
  coachingSignature,
  inCoachingNow,
  readableConversationIds,
} from "@/features/training/lib/coaching";

import { coachingApi, type CoachingState } from "./api";
import { coachOutbox } from "./outbox";
import { clearCoachPhotos, forgetCoachPhotos } from "./photos";

export interface CoachingSnapshot {
  /** null until the backend has answered */
  state: CoachingState | null;
  status: "idle" | "loading" | "ready" | "error";
  error: unknown;
}

const INITIAL: CoachingSnapshot = {
  state: null,
  status: "idle",
  error: null,
};

let snapshot = INITIAL;
let accountId: number | null = null;
/** Only the answer to the latest question counts */
let asked = 0;
let pending: Promise<void> | null = null;
let isAsking = false;
const listeners = new Set<() => void>();

function publish(next: CoachingSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** A state the backend answered with (state, accept, decline, end) */
function set(state: CoachingState | null): void {
  const before = snapshot.state;
  publish({ state, status: "ready", error: null });
  // Conversations this account may no longer read go. Without a connection
  // the state may be an old copy: nothing is dropped for it.
  if ((inCoachingNow(before) || inCoachingNow(state)) && navigator.onLine) {
    forgetCoachPhotos(coachOutbox.keep(readableConversationIds(state)));
  }
  if (inCoachingNow(state)) void coachOutbox.flush();
}

/** Asks the backend again; keeps what is known when that fails */
function refresh(): Promise<void> {
  const question = ++asked;
  if (!snapshot.state) publish({ ...snapshot, status: "loading" });
  isAsking = true;
  const answer = coachingApi.state().then(
    (state) => {
      if (question !== asked) return;
      isAsking = false;
      set(state);
    },
    (error: unknown) => {
      if (question !== asked) return;
      isAsking = false;
      publish({
        state: snapshot.state,
        status: snapshot.state ? "ready" : "error",
        error,
      });
    },
  );
  pending = answer;
  return answer;
}

function reset(): void {
  asked++;
  pending = null;
  isAsking = false;
  coachOutbox.clear();
  clearCoachPhotos();
  publish(INITIAL);
}

export const coachingStore = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  ensureLoaded(): Promise<void> {
    return snapshot.status === "idle" || !pending ? refresh() : pending;
  },
  refresh,
  /** For a screen opening: a question already under way is fresh enough */
  ensureFresh(): Promise<void> {
    return isAsking && pending ? pending : refresh();
  },
  /** An answer that already carries the new state */
  set(state: CoachingState | null): void {
    asked++;
    isAsking = false;
    set(state);
  },
  /** Another account never sees (or sends) the last one's coaching */
  setAccount(userId: number): void {
    if (accountId !== null && accountId !== userId) reset();
    accountId = userId;
  },
  reset(): void {
    accountId = null;
    reset();
  },
};

/**
 * For whoever calls `GET /coach-feedback/unread-dates`: hand over its
 * `X-LT-Coaching` header; the state is asked for again only when it moved.
 */
export function noteCoachingSignature(signature: string | null): void {
  if (!signature) return;
  if (signature === coachingSignature(snapshot.state)) return;
  void coachingStore.refresh();
}
