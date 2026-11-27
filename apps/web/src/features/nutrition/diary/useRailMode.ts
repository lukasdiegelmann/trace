import { useState } from "react";

/** The old UI's key, so both agree on whether the side column is pinned */
const KEY = "nt:diaryRailMode";

export type RailMode = "pinned" | "hidden";

export function useRailMode(): [RailMode, (mode: RailMode) => void] {
  const [mode, setMode] = useState<RailMode>(() => {
    try {
      return localStorage.getItem(KEY) === "hidden" ? "hidden" : "pinned";
    } catch {
      return "pinned";
    }
  });
  return [
    mode,
    (next) => {
      setMode(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // blocked storage: it lasts for this visit
      }
    },
  ];
}
