import type { CSSProperties } from "react";

/** The cover's colour fading out from the top */
export function tintStyle(color: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  return {
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${color} 40%, transparent), transparent 65%)`,
  };
}
