import { createContext, useContext, useEffect, useRef } from "react";

export interface BackStack {
  /** Registers an open layer; returns the unregister */
  open: (close: () => void) => () => void;
}

export const BackStackContext = createContext<BackStack | null>(null);

/** While `isOpen`, the browser's Back calls `close` for the topmost layer */
export function useBackToClose(isOpen: boolean, close: () => void): void {
  const stack = useContext(BackStackContext);
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!isOpen || !stack) return;
    return stack.open(() => {
      latest.current();
    });
  }, [isOpen, stack]);
}
