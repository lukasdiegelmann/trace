/** Where the CookTrace backend is mounted (deploy/SSO.md) */
const CT_PREFIX = "/ct/";

/**
 * Where a stored image or video lives for the browser. The backend stores
 * its own uploads as "/uploads/…" (relative to its mount, `/ct`); other
 * URLs (https, data) pass through. Empty and `javascript:` URLs give "".
 */
export function assetUrl(url: string | null | undefined): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  if (/^\/?uploads\//.test(value)) {
    return `${CT_PREFIX}${value.replace(/^\//, "")}`;
  }
  if (/^(https?:|data:(image|video)\/|blob:)/i.test(value)) return value;
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}
