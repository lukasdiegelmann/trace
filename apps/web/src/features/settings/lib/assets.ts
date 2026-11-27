import type { BackendId } from "@/api";

/**
 * A backend's stored asset URL as this origin serves it: `/uploads/x.jpg`
 * lives under the backend's prefix. Absolute and data URLs stay as they
 * are, and so does a URL that carries the prefix already.
 */
export function backendAssetUrl(backend: BackendId, url: string): string {
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  if (url === `/${backend}` || url.startsWith(`/${backend}/`)) return url;
  return `/${backend}${url}`;
}
