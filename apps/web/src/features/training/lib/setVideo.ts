/**
 * Plain logic of set videos (old `SetVideoSheet.svelte` and
 * `SetVideoPlayer.svelte`, issue #57 of LiftTrace): limits, the recorder's
 * MIME type, the upload file name, and the clock the sheets show.
 */
import type { WorkoutSet } from "./workoutTypes";

/** Longest in-app recording */
export const MAX_RECORD_SECONDS = 60;

/** The server's upload ceiling (routes/upload.js, `/set-video`) */
export const MAX_CLIP_BYTES = 200 * 1024 * 1024;

/**
 * 2.5 Mbps at 720p is plenty to see a bar path and a knee angle, and keeps a
 * minute under about 20 MB.
 */
export const RECORD_BITRATE = 2_500_000;

/** MediaRecorder types, best first */
export const RECORDER_MIME_PREFERENCE = [
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm",
] as const;

/** `m:ss`, e.g. `1:05` for 65 seconds */
export function clock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

/** The first type the recorder supports, or `""` to let it choose */
export function pickRecorderMime(
  isTypeSupported: ((type: string) => boolean) | undefined,
): string {
  if (!isTypeSupported) return "";
  return RECORDER_MIME_PREFERENCE.find((type) => isTypeSupported(type)) ?? "";
}

/**
 * The type without its parameters. MediaRecorder types its output
 * "video/mp4;codecs=vp9,opus", and that unquoted comma is one busboy cannot
 * parse, so the upload came back "Videos only".
 */
export function bareMimeType(type: string | undefined | null): string {
  return (type || "video/mp4").split(";")[0]?.trim() || "video/mp4";
}

/** The extension of a recorded clip's upload name */
export function clipExtension(type: string | undefined | null): "webm" | "mp4" {
  return (type || "").includes("webm") ? "webm" : "mp4";
}

/** Whether a picked clip is over the server's ceiling */
export function isOverClipLimit(bytes: number): boolean {
  return bytes > MAX_CLIP_BYTES;
}

/** Megabytes with one decimal, e.g. `12.3` (`12,3` in German) */
export function formatSizeMb(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bytes / 1024 / 1024);
}

/**
 * The set you are most likely filming: the first one not done, else the
 * last; `null` without sets.
 */
export function defaultSetUuid(
  sets: readonly WorkoutSet[] | undefined,
): string | null {
  if (!sets?.length) return null;
  const pick = sets.find((set) => !set.completed) ?? sets[sets.length - 1];
  return pick.uuid ?? null;
}
