/** How a recipe's video is shown (cooktrace/src/routes/RecipeView.svelte) */
import { assetUrl } from "./assetUrl";

export interface VideoEmbed {
  kind: "video" | "iframe" | "link";
  src: string;
}

export function videoEmbed(url: string | null | undefined): VideoEmbed | null {
  const value = (url ?? "").trim();
  if (!value) return null;
  if (/^\/?uploads\//.test(value)) {
    return { kind: "video", src: assetUrl(value) };
  }
  const isWeb = /^https?:\/\//i.test(value);
  if (isWeb && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value)) {
    return { kind: "video", src: value };
  }
  const youtube =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/.exec(
      value,
    );
  if (youtube) {
    return {
      kind: "iframe",
      src: `https://www.youtube.com/embed/${youtube[1]}`,
    };
  }
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(value);
  if (vimeo) {
    return {
      kind: "iframe",
      src: `https://player.vimeo.com/video/${vimeo[1]}`,
    };
  }
  // Only web links are offered; "javascript:" and the like are dropped.
  return isWeb ? { kind: "link", src: value } : null;
}
