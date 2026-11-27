import { useEffect } from "react";

import {
  clientsUnread,
  coachUnread,
  showsCoachingTab,
  showsCoachTab,
} from "@/features/training/lib/coaching";

import { coachingStore } from "./coachingStore";
import { useCoachingState } from "./useCoachingState";

export interface CoachingNavigation {
  /** A coach, a request to answer, or a past conversation */
  // eslint-disable-next-line @typescript-eslint/naming-convention -- agreed name
  showsCoach: boolean;
  /** Trainers and admins */
  // eslint-disable-next-line @typescript-eslint/naming-convention -- agreed name
  showsCoaching: boolean;
  coachUnread: number;
  clientsUnread: number;
}

/** What the training sub-navigation shows of coaching. Both flags are false
 *  until the state is there; keep the current route's entry visible. */
export function useCoachingNavigation(): CoachingNavigation {
  const { state } = useCoachingState();

  // The old UI learned of changes from a header of the diary's requests;
  // here the state is asked for again when the app comes back into view.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void coachingStore.ensureFresh();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return {
    showsCoach: showsCoachTab(state),
    showsCoaching: showsCoachingTab(state),
    coachUnread: coachUnread(state),
    clientsUnread: clientsUnread(state),
  };
}
