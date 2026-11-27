/**
 * The player's decisions that need no audio element, after
 * backends/lifttrace/src/stores/player.js and lib/mseStreamer.js.
 */

export const DEFAULT_MSE_MIME = "audio/mpeg";

/** The MediaSource MIME type of a Jellyfin `container`, null if none */
export function mimeForContainer(
  container: string | null | undefined,
): string | null {
  switch ((container ?? "").toLowerCase()) {
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "m4a":
    case "mp4":
    case "aac":
      return 'audio/mp4; codecs="mp4a.40.2"';
    case "ogg":
    case "oga":
      return 'audio/ogg; codecs="vorbis"';
    case "opus":
    case "webm":
      return 'audio/webm; codecs="opus"';
    default:
      return null;
  }
}

export interface MseOptions {
  mime: string;
  /** Append the original file (`streamUrl`) instead of the MP3 transcode */
  isRaw: boolean;
}

interface WithContainer {
  container?: string;
}

/**
 * Original files only if the user wants them, the whole queue has one codec
 * and MediaSource can play it; otherwise the MP3 transcode.
 */
export function decideMseOptions(
  queue: readonly WithContainer[],
  first: WithContainer,
  shouldKeepOriginal: boolean,
  isTypeSupported: (mime: string) => boolean,
): MseOptions {
  const transcoded = { mime: DEFAULT_MSE_MIME, isRaw: false };
  if (!shouldKeepOriginal) return transcoded;
  const containers = new Set(
    [...queue, first].map((track) => (track.container ?? "").toLowerCase()),
  );
  if (containers.size !== 1) return transcoded;
  const mime = mimeForContainer([...containers][0]);
  if (!mime || !isTypeSupported(mime)) return transcoded;
  return { mime, isRaw: true };
}

export function shouldCrossfade(
  crossfade: number,
  remaining: number,
  duration: number,
  isCrossfading: boolean,
): boolean {
  return (
    crossfade > 0 &&
    !isCrossfading &&
    remaining <= crossfade &&
    duration > crossfade + 2
  );
}

/** Reopening a live stream that broke (iHeart's HE-AAC does every ~5 s) */
export const STREAM_RECOVER_MAX = 60;
export const STREAM_RECOVER_DELAY_MS = 400;

export interface RecoveryState {
  trackId: string | null;
  count: number;
}

export const NO_RECOVERY: RecoveryState = { trackId: null, count: 0 };

/** Counts one more try; the budget is per track */
export function nextRecovery(
  state: RecoveryState,
  trackId: string,
): { state: RecoveryState; shouldRetry: boolean } {
  const count = state.trackId === trackId ? state.count : 0;
  if (count >= STREAM_RECOVER_MAX) {
    return { state: { trackId, count }, shouldRetry: false };
  }
  return { state: { trackId, count: count + 1 }, shouldRetry: true };
}

/** So the browser doesn't answer from its cached "this URL failed" */
export function withCacheBuster(url: string, now: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}_lr=${now}`;
}

/** Some lock screens fire next/previous twice for one tap */
export const SKIP_DEBOUNCE_MS = 300;

/** Answers whether a skip at `now` counts */
export function createSkipDebounce(
  gap: number = SKIP_DEBOUNCE_MS,
): (now: number) => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return (now) => {
    if (now - last < gap) return false;
    last = now;
    return true;
  };
}

/** "Artist - Song" for the Media Session; else the station is the artist */
export function splitArtistTitle(
  title: string,
  station: string,
): { artist: string; title: string } {
  const dash = title.indexOf(" - ");
  if (dash > 0) {
    return {
      artist: title.slice(0, dash).trim() || station,
      title: title.slice(dash + 3).trim(),
    };
  }
  return { artist: station, title: title || station };
}

export function isHlsUrl(url: string | null | undefined): boolean {
  return /\.m3u8(\?|$)/i.test(url ?? "");
}
