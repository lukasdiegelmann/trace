import { useState, type ReactNode } from "react";

import { ltAssetUrl } from "../common/assets";

export interface PlayerArtProps {
  /** Tried in order; one that fails to load makes way for the next */
  sources: (string | undefined)[];
  /** Shown when there is no picture */
  fallback: ReactNode;
  className?: string;
}

/** A cover or station icon with its fallbacks; decorative */
export function PlayerArt({ sources, fallback, className }: PlayerArtProps) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const source = sources
    .map((candidate) => ltAssetUrl(candidate))
    .find((candidate) => candidate !== undefined && !failed.has(candidate));

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-control bg-level-2 text-muted ${className ?? ""}`}
    >
      {source ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => {
            setFailed((before) => new Set(before).add(source));
          }}
        />
      ) : (
        <span aria-hidden>{fallback}</span>
      )}
    </div>
  );
}
