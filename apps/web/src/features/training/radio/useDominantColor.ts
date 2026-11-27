import { useEffect, useState } from "react";

import { dominantColor } from "../lib/radioColor";

const cache = new Map<string, string>();
const SAMPLE = 32;

function sample(source: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Without CORS headers the load fails and the default stays
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
        resolve(dominantColor(context.getImageData(0, 0, SAMPLE, SAMPLE).data));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => {
      resolve(null);
    };
    image.src = source;
  });
}

/** The cover's colour as `rgb(…)`, null until (or if never) known */
export function useDominantColor(source: string | undefined): string | null {
  const [found, setFound] = useState<{ source: string; color: string } | null>(
    null,
  );
  useEffect(() => {
    if (!source || cache.has(source)) return;
    let isCurrent = true;
    void sample(source).then((color) => {
      if (!color) return;
      cache.set(source, color);
      if (isCurrent) setFound({ source, color });
    });
    return () => {
      isCurrent = false;
    };
  }, [source]);
  if (!source) return null;
  return cache.get(source) ?? (found?.source === source ? found.color : null);
}
