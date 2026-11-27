/**
 * What an exercise's media fields mean, after MediaInput.svelte and
 * ExerciseInfo.svelte. An exercise carries one of img_url, gif_url,
 * video_url (imports may carry a start and an end frame).
 */

export type MediaKind = "img" | "gif" | "video";

export interface MediaFields {
  img_url?: string | null;
  gif_url?: string | null;
  video_url?: string | null;
}

/** The 11-character id of a YouTube link, or "" */
export function youTubeId(url: string | null | undefined): string {
  const match =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([^&?/\s]{11})/i.exec(
      url ?? "",
    );
  return match?.[1] ?? "";
}

export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}

/** The field a pasted URL belongs in */
export function mediaKindOfUrl(url: string): MediaKind {
  if (youTubeId(url) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return "video";
  return /\.gif(\?|$)/i.test(url) ? "gif" : "img";
}

/** The three fields with exactly one set */
export function singleMedia(
  kind: MediaKind,
  url: string,
): Required<MediaFields> {
  return {
    img_url: kind === "img" ? url : "",
    gif_url: kind === "gif" ? url : "",
    video_url: kind === "video" ? url : "",
  };
}

/** A start and an end photo (free-db imports), to be shown alternately */
export function isTwoFrame(media: MediaFields): boolean {
  const { img_url: img, gif_url: gif } = media;
  return Boolean(
    gif && img && gif !== img && /\.(jpg|jpeg|png|webp)$/i.test(gif),
  );
}
