/**
 * The music library in one shape, and the mapping of Jellyfin's (and
 * Emby's) and Plex's replies to it, after
 * backends/lifttrace/src/lib/radio-provider.js. Subsonic's replies already
 * have this shape.
 */

export interface Album {
  id: string;
  name: string;
  artist?: string;
  coverArt?: string;
  year?: number;
}

export interface Artist {
  id: string;
  name: string;
  albumCount?: number;
}

export interface ArtistGroup {
  name: string;
  artist?: Artist[];
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  albumId?: string;
  parent?: string;
  /** Seconds */
  duration?: number;
  coverArt?: string;
  container?: string;
}

export interface Playlist {
  id: string;
  name: string;
  songCount?: number;
}

export interface ArtistDetail {
  id: string;
  name: string;
  album?: Album[];
}

export interface AlbumDetail {
  id: string;
  name: string;
  artist?: string;
  coverArt?: string;
  songCount?: number;
  song?: Song[];
}

export interface PlaylistDetail {
  id: string;
  name: string;
  entry?: Song[];
}

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
}

export type Starred = SearchResults;

/** The artist index by first letter, in the order the letters appear */
export function groupByLetter(artists: readonly Artist[]): ArtistGroup[] {
  const groups = new Map<string, Artist[]>();
  for (const artist of artists) {
    const letter = (artist.name || "?").charAt(0).toUpperCase();
    const group = groups.get(letter);
    if (group) group.push(artist);
    else groups.set(letter, [artist]);
  }
  return [...groups].map(([name, artist]) => ({ name, artist }));
}

export interface JellyfinItem {
  Id: string;
  Name?: string;
  Type?: string;
  Album?: string;
  AlbumId?: string;
  AlbumArtist?: string;
  Artist?: string;
  Artists?: string[];
  AlbumCount?: number;
  ChildCount?: number;
  ProductionYear?: number;
  /** 100 ns steps */
  RunTimeTicks?: number;
  Container?: string;
}

export interface JellyfinItems {
  Items?: JellyfinItem[];
}

export function jellyfinArtist(item: JellyfinItem): Artist {
  return {
    id: item.Id,
    name: item.Name ?? "",
    albumCount: item.AlbumCount ?? 0,
  };
}

export function jellyfinAlbum(item: JellyfinItem): Album {
  return {
    id: item.Id,
    name: item.Name ?? "",
    artist: item.AlbumArtist || item.Artist || "",
    year: item.ProductionYear,
    coverArt: item.Id,
  };
}

function jellyfinSong(item: JellyfinItem): Song {
  return {
    id: item.Id,
    title: item.Name ?? "",
    artist: item.AlbumArtist || "",
    album: item.Album ?? "",
    albumId: item.AlbumId,
    duration: Math.round((item.RunTimeTicks ?? 0) / 10_000_000),
    coverArt: item.AlbumId || item.Id,
    container: (item.Container ?? "").toLowerCase(),
  };
}

export function jellyfinSongs(data: JellyfinItems): Song[] {
  return (data.Items ?? []).map(jellyfinSong);
}

/** An album from `Items/{id}` and the audio items below it */
export function jellyfinAlbumDetail(
  id: string,
  album: JellyfinItem,
  songs: JellyfinItems,
): AlbumDetail {
  const name = album.Name ?? "";
  const items = songs.Items ?? [];
  return {
    id,
    name,
    artist: album.AlbumArtist || album.Artist || "",
    coverArt: id,
    songCount: items.length,
    song: items.map((item) => ({
      ...jellyfinSong(item),
      artist: item.AlbumArtist || item.Artists?.[0] || "",
      album: name,
      albumId: id,
      coverArt: id,
    })),
  };
}

export function jellyfinSearch(data: JellyfinItems): SearchResults {
  const items = data.Items ?? [];
  const of = (type: string) => items.filter((item) => item.Type === type);
  return {
    artists: of("MusicArtist").map((item) => ({
      id: item.Id,
      name: item.Name ?? "",
    })),
    albums: of("MusicAlbum").map(jellyfinAlbum),
    songs: of("Audio").map(jellyfinSong),
  };
}

export interface PlexItem {
  ratingKey: string;
  title?: string;
  originalTitle?: string;
  parentTitle?: string;
  parentRatingKey?: string;
  grandparentTitle?: string;
  year?: number;
  leafCount?: number;
  /** Milliseconds */
  duration?: number;
}

export interface PlexReply {
  MediaContainer?: {
    Directory?: { key: string; type?: string }[];
    Metadata?: PlexItem[];
    Hub?: { type?: string; Metadata?: PlexItem[] }[];
  };
}

export function plexItems(data: PlexReply): PlexItem[] {
  return data.MediaContainer?.Metadata ?? [];
}

/** The key of the library section that holds music */
export function plexMusicSection(data: PlexReply): string | null {
  return (
    data.MediaContainer?.Directory?.find((entry) => entry.type === "artist")
      ?.key ?? null
  );
}

export function plexArtist(item: PlexItem): Artist {
  return { id: item.ratingKey, name: item.title ?? "" };
}

export function plexAlbum(item: PlexItem): Album {
  return {
    id: item.ratingKey,
    name: item.title ?? "",
    artist: item.parentTitle ?? "",
    year: item.year,
    coverArt: item.ratingKey,
  };
}

export function plexSong(item: PlexItem): Song {
  return {
    id: item.ratingKey,
    title: item.title ?? "",
    artist: item.grandparentTitle ?? "",
    album: item.parentTitle ?? "",
    albumId: item.parentRatingKey,
    duration: Math.round((item.duration ?? 0) / 1000),
    coverArt: item.parentRatingKey,
  };
}

export function plexAlbumDetail(
  id: string,
  meta: PlexReply,
  tracks: PlexReply,
): AlbumDetail {
  const album = plexItems(meta).at(0);
  const name = album?.title ?? "";
  const items = plexItems(tracks);
  return {
    id,
    name,
    artist: album?.parentTitle ?? "",
    coverArt: id,
    songCount: items.length,
    song: items.map((item) => ({
      ...plexSong(item),
      artist: item.grandparentTitle || item.originalTitle || "",
      album: name,
      albumId: id,
      coverArt: id,
    })),
  };
}

export function plexSearch(data: PlexReply): SearchResults {
  const hub = (type: string) =>
    data.MediaContainer?.Hub?.find((entry) => entry.type === type)?.Metadata ??
    [];
  return {
    artists: hub("artist").map(plexArtist),
    albums: hub("album").map(plexAlbum),
    songs: hub("track").map(plexSong),
  };
}
