/** Ported from LiftTrace's src/stores/coaching.js */
export interface CoachingState {
  role?: string;
  as_client?: unknown;
  requests?: unknown[];
  past?: unknown[];
  as_coach?: { pending?: number; active?: number; recent?: number } | null;
}

/** Someone with a coach, a request to answer, or a past conversation */
export function showsCoachTab(state: CoachingState | null): boolean {
  return Boolean(
    state?.as_client || state?.requests?.length || state?.past?.length,
  );
}

/** In coaching at all: Settings shows its notifications only then */
export function isInCoaching(state: CoachingState | null): boolean {
  if (!state) return false;
  if (showsCoachTab(state) || state.role === "trainer") return true;
  const counts = state.as_coach ?? {};
  return (
    state.role === "admin" &&
    (counts.pending ?? 0) + (counts.active ?? 0) + (counts.recent ?? 0) > 0
  );
}
