/** Open Food Facts' search options (ConnectedServices.svelte) */
export const OFF_LANGUAGES = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ru",
  "ja",
  "zh",
  "ar",
  "ko",
];

/** Stored as their English names */
export const OFF_COUNTRIES = [
  "World",
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Denmark",
  "Finland",
  "France",
  "Germany",
  "India",
  "Ireland",
  "Italy",
  "Japan",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Norway",
  "Poland",
  "Portugal",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Kingdom",
  "United States",
];

export interface OffMirrorStatus {
  size_bytes: number | null;
  mtime_ms: number | null;
  refresh?: {
    state?: string;
    progress?: number | null;
    bytes_done?: number | null;
    bytes_total?: number | null;
    last_error?: string | null;
  } | null;
  refresh_interval?: string | null;
}

export type OffMirrorState =
  | "downloading"
  | "failedEmpty"
  | "failedStale"
  | "stale"
  | "ready"
  | "notReady";

const INTERVAL_MS: Record<string, number> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
};

/** The old UI's banner states for the local OFF mirror */
export function offMirrorState(
  status: OffMirrorStatus,
  now: number = Date.now(),
): OffMirrorState {
  const hasData = Boolean(status.size_bytes);
  if (status.refresh?.state === "downloading") return "downloading";
  if (status.refresh?.state === "failed" || status.refresh?.last_error) {
    return hasData ? "failedStale" : "failedEmpty";
  }
  if (!hasData) return "notReady";
  const maxAge = INTERVAL_MS[status.refresh_interval ?? ""];
  if (maxAge && status.mtime_ms !== null && now - status.mtime_ms > maxAge) {
    return "stale";
  }
  return "ready";
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** USDA is asked from the browser, as in the old UI */
export async function testUsdaKey(
  key: string,
  doFetch: typeof fetch = fetch,
): Promise<void> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.search = new URLSearchParams({
    api_key: key,
    query: "apple",
    pageSize: "1",
  }).toString();
  const response = await doFetch(url.toString());
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
}
