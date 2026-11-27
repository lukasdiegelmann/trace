import { Utensils, Zap } from "lucide-react";
import { useState } from "react";

import { assetUrl } from "../api";

export interface FoodThumbProps {
  url?: string | null;
  isQuick?: boolean;
}

/** A food's picture, or an icon where there is none or it can't be loaded */
export function FoodThumb({ url, isQuick }: FoodThumbProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const source = assetUrl(url);
  const Icon = isQuick ? Zap : Utensils;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control bg-level-2 text-muted">
      {source && broken !== source ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => {
            setBroken(source);
          }}
        />
      ) : (
        <Icon aria-hidden size={18} />
      )}
    </span>
  );
}
