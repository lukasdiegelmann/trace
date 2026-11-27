/**
 * Photos of a conversation. They are private (the server hands them only to
 * the two people), so each one is fetched with the sign-in and shown from a
 * blob URL, which also tells "gone" apart from "no connection".
 */
import { ltAssetUrl } from "@/features/training/common/assets";

export type CoachPhotoResult =
  { kind: "ready"; url: string } | { kind: "gone" } | { kind: "error" };

const urls = new Map<string, string>();

export async function loadCoachPhoto(path: string): Promise<CoachPhotoResult> {
  // Written here, not sent yet
  if (path.startsWith("data:")) return { kind: "ready", url: path };
  const known = urls.get(path);
  if (known) return { kind: "ready", url: known };
  try {
    const response = await fetch(ltAssetUrl(path), {
      credentials: "same-origin",
      cache: "no-store",
    });
    // Deleted, or no longer this account's to see
    if (response.status === 403 || response.status === 404) {
      return { kind: "gone" };
    }
    if (!response.ok) return { kind: "error" };
    const url = URL.createObjectURL(await response.blob());
    urls.set(path, url);
    return { kind: "ready", url };
  } catch {
    return { kind: "error" };
  }
}

export function forgetCoachPhotos(paths: string[]): void {
  for (const path of paths) {
    const url = urls.get(path);
    if (!url) continue;
    URL.revokeObjectURL(url);
    urls.delete(path);
  }
}

export function clearCoachPhotos(): void {
  forgetCoachPhotos([...urls.keys()]);
}
