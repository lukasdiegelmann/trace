import { useContext, useEffect, useSyncExternalStore } from "react";

import { AuthContext } from "@/auth/AuthContext";

import { coachingStore, type CoachingSnapshot } from "./coachingStore";

/** The LiftTrace id of who is signed in, null while unknown */
export function useLtUserId(): number | null {
  const session = useContext(AuthContext)?.sessions?.lt;
  return session?.state === "signed-in" ? session.user.id : null;
}

/** The coaching state, loaded on first use */
export function useCoachingState(): CoachingSnapshot {
  const userId = useLtUserId();
  const snapshot = useSyncExternalStore(
    coachingStore.subscribe,
    coachingStore.getSnapshot,
  );
  const isIdle = snapshot.status === "idle";
  useEffect(() => {
    if (userId !== null) coachingStore.setAccount(userId);
    if (coachingStore.getSnapshot().status === "idle") {
      void coachingStore.ensureLoaded();
    }
  }, [userId, isIdle]);
  return snapshot;
}
