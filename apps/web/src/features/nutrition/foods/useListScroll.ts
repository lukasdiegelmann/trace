import { useEffect, useRef, type RefObject } from "react";

const KEY = "nt:foodsScroll:";

/**
 * Remembers how far the list was scrolled when it is left (e.g. for an
 * editor) and returns there once its entries are back. The scroller is the
 * app shell's `main`.
 */
export function useListScroll(
  root: RefObject<HTMLElement | null>,
  id: string,
  isReady: boolean,
): void {
  const position = useRef(0);
  useEffect(() => {
    const scroller = root.current?.closest("main");
    if (!scroller) return;
    const track = () => {
      position.current = scroller.scrollTop;
    };
    scroller.addEventListener("scroll", track, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", track);
      sessionStorage.setItem(KEY + id, String(position.current));
    };
  }, [root, id]);

  const isRestored = useRef(false);
  useEffect(() => {
    if (!isReady || isRestored.current) return;
    isRestored.current = true;
    const scroller = root.current?.closest("main");
    const stored = Number(sessionStorage.getItem(KEY + id));
    sessionStorage.removeItem(KEY + id);
    if (scroller && stored > 0) scroller.scrollTop = stored;
  }, [isReady, root, id]);
}
