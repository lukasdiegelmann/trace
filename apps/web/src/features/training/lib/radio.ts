/**
 * The Radio screen's logic: stations, tabs, favorites and the saved view,
 * after backends/lifttrace/src/routes/Radio.svelte.
 */
import { apiPath } from "@/api";

import { isHlsUrl } from "./radioPlayback";

/** What the player plays: a library song or a radio station */
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId?: string;
  /** Seconds, 0 for streams */
  duration: number;
  container?: string;
  coverUrl: string;
  streamUrl: string;
  transcodeUrl?: string | null;
  isStream?: boolean;
  /** The station's own URL, for the now-playing poll */
  originalUrl?: string;
}

/** One entry of the `radioStations` setting */
export interface Station {
  id: string;
  name: string;
  url: string;
  genre: string;
  iconUrl: string;
  group: string;
  homepage: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The setting's value as stations; unknown fields of an entry stay */
export function parseStations(value: unknown): Station[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    return [
      {
        ...record,
        id: text(record.id),
        name: text(record.name),
        url: text(record.url),
        genre: text(record.genre),
        iconUrl: text(record.iconUrl),
        group: text(record.group),
        homepage: text(record.homepage),
      },
    ];
  });
}

function groupOf(station: Station): string {
  return station.group.trim();
}

export interface StationGroup {
  /** "" for the ungrouped stations */
  name: string;
  stations: Station[];
}

/** Named groups in the order they first appear, the ungrouped ones last */
export function groupStations(list: readonly Station[]): StationGroup[] {
  const groups = new Map<string, Station[]>();
  for (const station of list) {
    const name = groupOf(station);
    const group = groups.get(name);
    if (group) group.push(station);
    else groups.set(name, [station]);
  }
  return [...groups]
    .map(([name, stations]) => ({ name, stations }))
    .sort((a, b) => Number(a.name === "") - Number(b.name === ""));
}

/** The key a collapsed group is remembered under */
export function groupKey(group: string): string {
  return group.trim() || "__ungrouped__";
}

export function existingGroups(list: readonly Station[]): string[] {
  return [...new Set(list.map(groupOf).filter(Boolean))];
}

export function existingStationUrls(list: readonly Station[]): Set<string> {
  return new Set(list.map((station) => station.url.trim()).filter(Boolean));
}

/** The index of the nearest station of the same group, -1 at the edge */
function neighbourOf(
  list: readonly Station[],
  id: string,
  direction: "up" | "down",
): [number, number] {
  const from = list.findIndex((station) => station.id === id);
  if (from < 0) return [-1, -1];
  const group = groupOf(list[from]);
  const step = direction === "up" ? -1 : 1;
  for (let i = from + step; i >= 0 && i < list.length; i += step) {
    if (groupOf(list[i]) === group) return [from, i];
  }
  return [from, -1];
}

export function canMove(
  list: readonly Station[],
  id: string,
  direction: "up" | "down",
): boolean {
  return neighbourOf(list, id, direction)[1] >= 0;
}

export function moveStation(
  list: readonly Station[],
  id: string,
  direction: "up" | "down",
): Station[] {
  const copy = [...list];
  const [from, to] = neighbourOf(list, id, direction);
  if (from >= 0 && to >= 0) {
    [copy[from], copy[to]] = [copy[to], copy[from]];
  }
  return copy;
}

/** Drops before the target and takes over its group */
export function dropOnStation(
  list: readonly Station[],
  dragId: string,
  targetId: string,
): Station[] {
  const dragged = list.find((station) => station.id === dragId);
  const target = list.find((station) => station.id === targetId);
  if (!dragged || !target || dragId === targetId) return [...list];
  const copy = list.filter((station) => station !== dragged);
  copy.splice(copy.indexOf(target), 0, { ...dragged, group: target.group });
  return copy;
}

/** Appends to the end of a group and sets the group */
export function dropOnGroup(
  list: readonly Station[],
  dragId: string,
  group: string,
): Station[] {
  const dragged = list.find((station) => station.id === dragId);
  if (!dragged) return [...list];
  const copy = list.filter((station) => station !== dragged);
  const last = copy.findLastIndex(
    (station) => groupOf(station) === group.trim(),
  );
  copy.splice(last < 0 ? copy.length : last + 1, 0, { ...dragged, group });
  return copy;
}

/** An empty new name ungroups the stations */
export function renameGroup(
  list: readonly Station[],
  from: string,
  to: string,
): Station[] {
  return list.map((station) =>
    groupOf(station) === from.trim()
      ? { ...station, group: to.trim() }
      : station,
  );
}

/** Replaces the station of the same id in place, or appends it */
export function upsertStation(
  list: readonly Station[],
  record: Station,
): Station[] {
  return list.some((station) => station.id === record.id)
    ? list.map((station) =>
        station.id === record.id ? { ...station, ...record } : station,
      )
    : [...list, record];
}

export function deleteStation(list: readonly Station[], id: string): Station[] {
  return list.filter((station) => station.id !== id);
}

export type StationForm = Omit<Station, "id">;

export const EMPTY_STATION_FORM: StationForm = {
  name: "",
  url: "",
  genre: "",
  iconUrl: "",
  group: "",
  homepage: "",
};

export function stationToForm(station: Station): StationForm {
  const { name, url, genre, iconUrl, group, homepage } = station;
  return { name, url, genre, iconUrl, group, homepage };
}

/** The trimmed record; null while name or URL is missing */
export function stationFromForm(form: StationForm, id: string): Station | null {
  const record: Station = {
    id,
    name: form.name.trim(),
    url: form.url.trim(),
    genre: form.genre.trim(),
    iconUrl: form.iconUrl.trim(),
    group: form.group.trim(),
    homepage: form.homepage.trim(),
  };
  return record.name && record.url ? record : null;
}

export function newStationId(now: number): string {
  return `station:${now}`;
}

export function browsedStationId(
  now: number,
  random: () => number = Math.random,
): string {
  return `station:${now}:${random().toString(36).slice(2, 8)}`;
}

/** A search result of radio-browser.info, the fields the app reads */
export interface RadioBrowserStation {
  name?: string;
  url?: string;
  url_resolved?: string;
  favicon?: string;
  tags?: string;
  homepage?: string;
  country?: string;
  bitrate?: number;
}

function tagsOf(result: RadioBrowserStation): string[] {
  return (result.tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function resultUrl(result: RadioBrowserStation): string {
  return result.url_resolved || result.url || "";
}

export function radioBrowserToStation(
  result: RadioBrowserStation,
  id: string,
): Station {
  return {
    id,
    // Stored data: the same fallback as the old app, in every language
    name: result.name || "Unnamed",
    url: resultUrl(result),
    genre: tagsOf(result).join(" / "),
    iconUrl: result.favicon ?? "",
    group: "",
    homepage: result.homepage ?? "",
  };
}

export function isAlreadyAdded(
  result: RadioBrowserStation,
  urls: ReadonlySet<string>,
): boolean {
  return urls.has(resultUrl(result).trim());
}

/** "country · N kbps · first two tags" */
export function radioBrowserSubtitle(result: RadioBrowserStation): string {
  return [
    result.country,
    result.bitrate ? `${result.bitrate} kbps` : "",
    tagsOf(result).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Anything but HLS goes through the backend's proxy, so the audio stays
 * same-origin (for a Web Audio analyser) and its ICY blocks are read.
 */
export function stationStreamUrl(station: Pick<Station, "url">): string {
  if (isHlsUrl(station.url)) return station.url;
  return `${apiPath("lt", "/radio-proxy")}?url=${encodeURIComponent(station.url)}`;
}

export function stationToTrack(
  station: Station,
  fallbackArtist: string,
): Track {
  return {
    id: station.id,
    title: station.name,
    artist: station.genre || fallbackArtist,
    album: "",
    coverUrl: station.iconUrl,
    streamUrl: stationStreamUrl(station),
    transcodeUrl: null,
    duration: 0,
    isStream: true,
    originalUrl: station.url,
  };
}

function minutesSeconds(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A track's length in a list: "" when unknown */
export function fmtDuration(seconds: number | null | undefined): string {
  return seconds ? minutesSeconds(seconds) : "";
}

/** A position in the player: "0:00" when unknown */
export function fmtTime(seconds: number | null | undefined): string {
  return seconds && Number.isFinite(seconds) ? minutesSeconds(seconds) : "0:00";
}

export const RADIO_TABS = [
  "albums",
  "artists",
  "playlists",
  "starred",
  "stations",
  "search",
] as const;

export type RadioTab = (typeof RADIO_TABS)[number];

export interface RadioFeatures {
  hasMusic: boolean;
  hasStations: boolean;
  /** Only Subsonic has favorites */
  hasStars: boolean;
}

export function isMusicAvailable(isEnabled: unknown, url: unknown): boolean {
  return Boolean(isEnabled) && Boolean(url);
}

/** Whether the app has a Radio section at all */
export function shouldShowRadioNav(
  isEnabled: unknown,
  url: unknown,
  hasStations: unknown,
): boolean {
  return isMusicAvailable(isEnabled, url) || Boolean(hasStations);
}

/** The tab row; search has its own button */
export function availableTabs(features: RadioFeatures): RadioTab[] {
  const tabs: RadioTab[] = [];
  if (features.hasMusic) {
    tabs.push("albums", "artists", "playlists");
    if (features.hasStars) tabs.push("starred");
  }
  if (features.hasStations) tabs.push("stations");
  return tabs;
}

/**
 * The tab to show instead of `tab` when what it needs is off; "redirect"
 * when there is neither music nor stations.
 */
export function resolveTab(
  tab: RadioTab,
  features: RadioFeatures,
): RadioTab | "redirect" {
  const { hasMusic, hasStations, hasStars } = features;
  if (!hasMusic) return hasStations ? "stations" : "redirect";
  if (tab === "stations" && !hasStations) return "albums";
  if (tab === "starred" && !hasStars) return "albums";
  return tab;
}

export type StationsSubTab = "my" | "browse";

export interface SelectedItem {
  id: string;
  name: string;
}

/** What survives leaving the page (sessionStorage `lt:radio:state`) */
export interface RadioViewState {
  tab: RadioTab | null;
  stationsSubTab: StationsSubTab;
  search: string;
  selectedAlbumId: string | null;
  selectedArtistId: string | null;
  selectedPlaylistId: string | null;
  /** Some servers' detail replies carry no name */
  selectedArtistName: string;
  selectedPlaylistName: string;
  scrollY: number;
}

export const RADIO_STATE_KEY = "lt:radio:state";

export function parseViewState(raw: string | null): RadioViewState {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    if (typeof parsed === "object" && parsed !== null) {
      saved = parsed as Record<string, unknown>;
    }
  } catch {
    // unreadable: the defaults
  }
  const id = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : null;
  return {
    tab: RADIO_TABS.find((tab) => tab === saved.tab) ?? null,
    stationsSubTab: saved.stationsSubTab === "browse" ? "browse" : "my",
    search: text(saved.search),
    selectedAlbumId: id(saved.selectedAlbumId),
    selectedArtistId: id(saved.selectedArtistId),
    selectedPlaylistId: id(saved.selectedPlaylistId),
    selectedArtistName: text(saved.selectedArtistName),
    selectedPlaylistName: text(saved.selectedPlaylistName),
    scrollY: typeof saved.scrollY === "number" ? saved.scrollY : 0,
  };
}

export type StarKind = "song" | "album" | "artist";

export function starKey(kind: StarKind, id: string): string {
  return kind === "song" ? id : `${kind}:${id}`;
}

export interface StarArgs {
  id?: string;
  albumId?: string;
  artistId?: string;
}

export function starArgs(kind: StarKind, id: string): StarArgs {
  if (kind === "song") return { id };
  return kind === "album" ? { albumId: id } : { artistId: id };
}

export function starredIdSet(starred: {
  songs: readonly { id: string }[];
  albums: readonly { id: string }[];
  artists: readonly { id: string }[];
}): Set<string> {
  return new Set([
    ...starred.songs.map((song) => starKey("song", song.id)),
    ...starred.albums.map((album) => starKey("album", album.id)),
    ...starred.artists.map((artist) => starKey("artist", artist.id)),
  ]);
}
