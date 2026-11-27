/**
 * A screen opened from the settings search (`?q=`) scrolls to the first
 * heading or label with the searched word and marks it for a moment
 * (Settings.svelte).
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

// Monolithium's checkbox is a role, not a <label>.
const CANDIDATES = "h2, h3, label, [role=checkbox]";
const MARK = ["ring-2", "ring-accent", "rounded-inner"];
const RETRY_MS = 150;
const RETRIES = 20;
const MARK_MS = 2500;

export function findSearchTarget(
  root: ParentNode,
  query: string,
): HTMLElement | null {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const all = Array.from(root.querySelectorAll<HTMLElement>(CANDIDATES));
  const has = (element: HTMLElement, word: string) =>
    element.textContent.toLocaleLowerCase().includes(word);
  return (
    all.find((element) => words.every((word) => has(element, word))) ??
    all.find((element) => words.some((word) => has(element, word))) ??
    null
  );
}

export function useSearchTarget() {
  const frame = useRef<HTMLDivElement>(null);
  const query = new URLSearchParams(useLocation().search).get("q") ?? "";

  useEffect(() => {
    if (!query) return;
    let tries = 0;
    let unmark: ReturnType<typeof setTimeout> | undefined;
    let marked: HTMLElement | null = null;
    // The sections appear as their data arrives.
    const search = setInterval(() => {
      tries += 1;
      const found = frame.current && findSearchTarget(frame.current, query);
      if (found) {
        marked = found;
        // jsdom has no scrollIntoView.
        if ("scrollIntoView" in found) {
          found.scrollIntoView({ block: "center" });
        }
        found.classList.add(...MARK);
        unmark = setTimeout(() => {
          found.classList.remove(...MARK);
        }, MARK_MS);
      }
      if (found || tries >= RETRIES) clearInterval(search);
    }, RETRY_MS);
    return () => {
      clearInterval(search);
      clearTimeout(unmark);
      marked?.classList.remove(...MARK);
    };
  }, [query]);

  return frame;
}
