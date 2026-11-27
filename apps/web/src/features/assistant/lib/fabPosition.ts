/** Where the assistant button sits: its distance from the bottom right */
export interface FabPosition {
  right: number;
  bottom: number;
}

export const FAB_SIZE = 48;
export const FAB_STORAGE_KEY = "trace.assistantFab";
const MARGIN = 8;

export function clampFab(
  position: FabPosition,
  width: number,
  height: number,
): FabPosition {
  const clamp = (value: number, size: number) =>
    Math.min(
      Math.max(MARGIN, value),
      Math.max(MARGIN, size - FAB_SIZE - MARGIN),
    );
  return {
    right: clamp(position.right, width),
    bottom: clamp(position.bottom, height),
  };
}

export function defaultFab(width: number): FabPosition {
  // Above the phone's floating navigation bar.
  return { right: 16, bottom: width < 768 ? 88 : 24 };
}

export function readFab(width: number, height: number): FabPosition {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(FAB_STORAGE_KEY) ?? "null",
    ) as Partial<FabPosition> | null;
    if (
      typeof stored?.right === "number" &&
      typeof stored.bottom === "number"
    ) {
      return clampFab(
        { right: stored.right, bottom: stored.bottom },
        width,
        height,
      );
    }
  } catch {
    // Unreadable: the default.
  }
  return defaultFab(width);
}

export function saveFab(position: FabPosition): void {
  try {
    window.localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Private mode: for this page only.
  }
}
