/**
 * LiftTrace's station routes (backends/lifttrace/server/routes/radio-proxy.js)
 * and the radio-browser.info directory. The music library is in provider.ts.
 */
import { api } from "@/api";

import type { RadioBrowserStation } from "../lib/radio";

/** `GET /radio-proxy/info`: the station's `icy-*` headers, "" when unknown */
export interface StationInfo {
  name?: string;
  genre?: string;
  bitrate?: string;
  url?: string;
}

/** `GET /radio-proxy/icon-suggest` */
export interface IconSuggestion {
  iconUrl?: string;
}

/** `GET /radio-proxy/now-playing` */
export interface NowPlaying {
  title?: string;
  artwork?: string;
  updatedAt?: number;
  source?: string;
}

export function fetchStationInfo(url: string): Promise<StationInfo> {
  return api.lt.get<StationInfo>("/radio-proxy/info", { query: { url } });
}

export async function suggestStationIcon(url: string): Promise<string> {
  const reply = await api.lt.get<IconSuggestion | undefined>(
    "/radio-proxy/icon-suggest",
    { query: { url } },
  );
  return reply?.iconUrl ?? "";
}

/** `url` is the station's own, not the proxied one */
export function fetchNowPlaying(url: string): Promise<NowPlaying> {
  return api.lt.get<NowPlaying>("/radio-proxy/now-playing", {
    query: { url },
  });
}

const RADIO_BROWSER_URL =
  "https://de1.api.radio-browser.info/json/stations/search";

/** The public station directory: CORS-enabled, no key */
export async function searchRadioBrowser(
  query: string,
  signal?: AbortSignal,
): Promise<RadioBrowserStation[]> {
  const params = new URLSearchParams({
    name: query,
    limit: "30",
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });
  const response = await fetch(`${RADIO_BROWSER_URL}?${params.toString()}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`radio-browser.info answered ${response.status}`);
  }
  return (await response.json()) as RadioBrowserStation[];
}
