/**
 * A still for a `<video>` that has not been played yet (old
 * `lib/video-poster.js`). Mobile browsers draw their own play glyph over a
 * video with no poster and no decoded frame, which reads as a broken
 * thumbnail; a poster replaces it with the actual first frame.
 */

/** A JPEG data URL from a `<video>` showing a frame, or `null` */
export function posterFromElement(
  element: HTMLVideoElement | null,
): string | null {
  try {
    if (!element?.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas
      .getContext("2d")
      ?.drawImage(element, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.7);
    return url.startsWith("data:image/jpeg") ? url : null;
  } catch {
    return null;
  }
}

export interface VideoProbe {
  poster: string | null;
  /** Whole seconds */
  duration: number | null;
}

/**
 * Decodes a clip offscreen for a still and its length. Resolves with nulls
 * rather than throwing, and gives up after `timeoutMs` so a file this browser
 * cannot decode never holds a screen up.
 */
export function probeVideoBlob(
  blob: Blob | null,
  timeoutMs = 3000,
): Promise<VideoProbe> {
  return new Promise((resolve) => {
    if (!blob) {
      resolve({ poster: null, duration: null });
      return;
    }
    let url: string;
    try {
      url = URL.createObjectURL(blob);
    } catch {
      resolve({ poster: null, duration: null });
      return;
    }
    const video = document.createElement("video");
    let isSettled = false;
    const done = (poster: string | null) => {
      if (isSettled) return;
      isSettled = true;
      const duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.round(video.duration)
          : null;
      try {
        URL.revokeObjectURL(url);
      } catch {
        // nothing to free
      }
      resolve({ poster, duration });
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    // A little way in: frame zero is often the camera still settling.
    video.addEventListener("loadeddata", () => {
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      } catch {
        done(null);
      }
    });
    video.addEventListener("seeked", () => {
      done(posterFromElement(video));
    });
    video.addEventListener("error", () => {
      done(null);
    });
    setTimeout(() => {
      done(null);
    }, timeoutMs);
  });
}
