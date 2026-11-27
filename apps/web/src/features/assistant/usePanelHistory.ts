/**
 * The panel is a history entry of the page under it, so the browser's (and
 * Android's) Back closes it. A router blocker can't do this: React Router
 * allows only one, and screens use theirs.
 */
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

const KEY = "isAssistantOpen";

export function usePanelHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as Record<string, unknown> | null;
  const isOpen = Boolean(state?.[KEY]);
  const { pathname, search, hash } = location;

  const openPanel = useCallback(() => {
    void navigate(
      { pathname, search, hash },
      { state: { ...state, [KEY]: true } },
    );
  }, [navigate, pathname, search, hash, state]);
  // Escape may reach the sheet and the page: one step back, not two.
  const isClosing = useRef(false);
  useEffect(() => {
    isClosing.current = false;
  }, [location.key]);
  const closePanel = useCallback(() => {
    if (!isOpen || isClosing.current) return;
    isClosing.current = true;
    void navigate(-1);
  }, [isOpen, navigate]);

  return { isOpen, openPanel, closePanel };
}
