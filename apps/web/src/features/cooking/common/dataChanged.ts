/**
 * Fired on `window` after something outside a screen (the assistant) changed
 * CookTrace data, so every open screen that shows it loads again.
 */
import { useEffect } from "react";

export const COOKING_DATA_CHANGED = "trace:ct-data-changed";

export function announceCookingChange(): void {
  window.dispatchEvent(new CustomEvent(COOKING_DATA_CHANGED));
}

export function useCookingDataChanged(onChange: () => void): void {
  useEffect(() => {
    window.addEventListener(COOKING_DATA_CHANGED, onChange);
    return () => {
      window.removeEventListener(COOKING_DATA_CHANGED, onChange);
    };
  }, [onChange]);
}
