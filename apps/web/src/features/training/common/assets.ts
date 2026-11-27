/**
 * Media URLs from LiftTrace (exercise pictures, uploads) as the browser can
 * load them. The backend answers with root-relative paths (`/uploads/...`,
 * `/api/...`) of its own origin; here it lives under `/lt`. Full URLs and
 * inline data stay as they are. The web counterpart of the old
 * `resolveAssetUrl` (src/lib/platform.js), without the Android branches.
 */
export function ltAssetUrl(url: string): string;
export function ltAssetUrl(url: string | null | undefined): string | undefined;
export function ltAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/lt/")) return url;
  if (url.startsWith("/uploads/") || url.startsWith("/api/"))
    return `/lt${url}`;
  return url;
}
