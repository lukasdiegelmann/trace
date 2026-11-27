import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches now; false where there is no `matchMedia` */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => {
        media.removeEventListener("change", listener);
      };
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );
}
