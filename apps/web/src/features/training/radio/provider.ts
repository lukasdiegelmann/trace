/**
 * The music server behind LiftTrace's proxy (/api/subsonic/*), one client
 * per provider, after backends/lifttrace/src/lib/{radio-provider,subsonic}.js.
 *
 * These calls don't go through `api.lt`: the proxy passes the music
 * server's own 401 on ("refused the sign-in"), which must not end the
 * LiftTrace session.
 */
import { api, apiPath } from "@/api";

import type { StarArgs, Track } from "../lib/radio";
import {
  groupByLetter,
  jellyfinAlbum,
  jellyfinAlbumDetail,
  jellyfinArtist,
  jellyfinSearch,
  jellyfinSongs,
  plexAlbum,
  plexAlbumDetail,
  plexArtist,
  plexItems,
  plexMusicSection,
  plexSearch,
  plexSong,
  type Album,
  type AlbumDetail,
  type Artist,
  type ArtistDetail,
  type ArtistGroup,
  type JellyfinItem,
  type JellyfinItems,
  type Playlist,
  type PlaylistDetail,
  type PlexReply,
  type SearchResults,
  type Song,
  type Starred,
} from "../lib/radioProviders";
import { buildSubsonicParams } from "../lib/radioSubsonic";

export type ProviderId = "subsonic" | "jellyfin" | "plex" | "emby";

export interface ProviderConfig {
  provider: string;
  user: string;
  password: string;
}

export type AlbumListType = "random" | "recent" | "frequent" | "newest";

export interface RadioProvider {
  id: ProviderId;
  /** Favorites: only Subsonic has one call that lists them all */
  hasStars: boolean;
  ping: () => Promise<boolean>;
  getArtists: () => Promise<ArtistGroup[]>;
  getArtist: (id: string) => Promise<ArtistDetail>;
  getAlbum: (id: string) => Promise<AlbumDetail>;
  getAlbumList: (type: AlbumListType, size: number) => Promise<Album[]>;
  search: (query: string) => Promise<SearchResults>;
  getPlaylists: () => Promise<Playlist[]>;
  getPlaylist: (id: string) => Promise<PlaylistDetail>;
  getRandomSongs: (size: number) => Promise<Song[]>;
  getStarred: () => Promise<Starred>;
  star: (args: StarArgs) => Promise<void>;
  unstar: (args: StarArgs) => Promise<void>;
  /** The same URL for the same cover, so it isn't loaded again */
  coverArtUrl: (id: string | undefined, size?: number) => string;
  songToTrack: (song: Song) => Track;
}

/** The music server or the proxy refused a call */
export class ProviderError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message || `API error ${status}`);
    this.name = "ProviderError";
    this.status = status;
  }
}

type Params = Record<string, string>;

async function proxyJson<T>(path: string, params: Params = {}): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const url = apiPath("lt", `/subsonic${path}${query ? `?${query}` : ""}`);
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    const message = typeof body?.error === "string" ? body.error : undefined;
    // LiftTrace's own 401: let the API client find out and sign in again
    if (response.status === 401 && message === "Not authenticated") {
      void api.lt.get("/settings").catch(() => undefined);
    }
    throw new ProviderError(response.status, message);
  }
  return (await response.json()) as T;
}

function memoCover(
  build: (id: string, size: number) => string,
): RadioProvider["coverArtUrl"] {
  const urls = new Map<string, string>();
  return (id, size = 300) => {
    if (!id) return "";
    const key = `${size}:${id}`;
    let url = urls.get(key);
    if (!url) {
      url = build(id, size);
      urls.set(key, url);
    }
    return url;
  };
}

function baseTrack(
  song: Song,
  unknownArtist: string,
): Omit<Track, "coverUrl" | "streamUrl"> {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist || unknownArtist,
    album: song.album ?? "",
    albumId: song.albumId,
    duration: song.duration ?? 0,
  };
}

interface SubsonicRoot {
  status?: string;
  error?: { message?: string };
  artists?: { index?: ArtistGroup[] };
  artist?: ArtistDetail;
  album?: AlbumDetail;
  albumList2?: { album?: Album[] };
  searchResult3?: { artist?: Artist[]; album?: Album[]; song?: Song[] };
  playlists?: { playlist?: Playlist[] };
  playlist?: PlaylistDetail;
  randomSongs?: { song?: Song[] };
  starred2?: { artist?: Artist[]; album?: Album[]; song?: Song[] };
}

function subsonic(
  config: ProviderConfig,
  unknownArtist: string,
): RadioProvider {
  const url = (method: string, params: Params = {}) =>
    apiPath(
      "lt",
      `/subsonic/rest/${method}?${buildSubsonicParams(config, params).toString()}`,
    );

  async function call(
    method: string,
    params: Params = {},
  ): Promise<SubsonicRoot> {
    const data = await proxyJson<{ "subsonic-response"?: SubsonicRoot }>(
      `/rest/${method}`,
      Object.fromEntries(buildSubsonicParams(config, params)),
    );
    const root = data["subsonic-response"];
    if (root?.status !== "ok") {
      throw new ProviderError(
        200,
        root?.error?.message ?? `Subsonic error: ${method}`,
      );
    }
    return root;
  }

  const results = (found: SubsonicRoot["searchResult3"]): SearchResults => ({
    artists: found?.artist ?? [],
    albums: found?.album ?? [],
    songs: found?.song ?? [],
  });

  const coverArtUrl = memoCover((id, size) =>
    url("getCoverArt", { id, size: String(size) }),
  );

  return {
    id: "subsonic",
    hasStars: true,
    ping: async () => {
      await call("ping");
      return true;
    },
    getArtists: async () => (await call("getArtists")).artists?.index ?? [],
    getArtist: async (id) =>
      (await call("getArtist", { id })).artist ?? { id, name: "" },
    getAlbum: async (id) =>
      (await call("getAlbum", { id })).album ?? { id, name: "" },
    getAlbumList: async (type, size) =>
      (
        await call("getAlbumList2", {
          type,
          size: String(size),
          offset: "0",
        })
      ).albumList2?.album ?? [],
    search: async (query) =>
      results(
        (
          await call("search3", {
            query,
            artistCount: "10",
            albumCount: "10",
            songCount: "20",
          })
        ).searchResult3,
      ),
    getPlaylists: async () =>
      (await call("getPlaylists")).playlists?.playlist ?? [],
    getPlaylist: async (id) =>
      (await call("getPlaylist", { id })).playlist ?? { id, name: "" },
    getRandomSongs: async (size) =>
      (await call("getRandomSongs", { size: String(size) })).randomSongs
        ?.song ?? [],
    getStarred: async () => results((await call("getStarred2")).starred2),
    star: async (args) => {
      await call("star", { ...args });
    },
    unstar: async (args) => {
      await call("unstar", { ...args });
    },
    coverArtUrl,
    // No transcode URL (as before): Subsonic never uses the MSE path
    songToTrack: (song) => ({
      ...baseTrack(song, unknownArtist),
      albumId: song.albumId || song.parent,
      coverUrl: coverArtUrl(song.coverArt || song.albumId),
      streamUrl: url("stream", { id: song.id }),
    }),
  };
}

const NO_STARS = {
  hasStars: false,
  getStarred: () =>
    Promise.resolve<Starred>({ songs: [], albums: [], artists: [] }),
  star: () => Promise.resolve(),
  unstar: () => Promise.resolve(),
};

const TRANSCODE_QUERY =
  "Container=opus,webm,mp3|mp3,aac,m4a|aac,flac&TranscodingContainer=mp3&TranscodingProtocol=http&AudioCodec=mp3&MaxStreamingBitrate=320000";

/** Cover, stream and transcode of Jellyfin and Emby, below `jf` or `emby` */
function jellyfinMedia(prefix: "jf" | "emby") {
  const base = apiPath("lt", `/subsonic/provider/${prefix}`);
  const item = (id: string) => encodeURIComponent(id);
  return {
    coverArtUrl: memoCover(
      (id, size) =>
        `${base}/Items/${item(id)}/Images/Primary?maxWidth=${size}&maxHeight=${size}`,
    ),
    streamUrl: (id: string) => `${base}/Audio/${item(id)}/stream?static=true`,
    transcodeUrl: (id: string) =>
      `${base}/Audio/${item(id)}/universal?${TRANSCODE_QUERY}`,
  };
}

function jellyfin(unknownArtist: string): RadioProvider {
  const get = <T>(path: string, params?: Params) =>
    proxyJson<T>(`/provider/jf/${path}`, params);
  const items = (params: Params) => get<JellyfinItems>("Items", params);
  const media = jellyfinMedia("jf");

  return {
    ...NO_STARS,
    id: "jellyfin",
    ping: async () => {
      // Needs a signed-in user: the public info page also answers with a
      // wrong password. /Users/Me is Jellyfin 10.8+.
      try {
        await get("Users/Me");
      } catch (caught) {
        if (!(caught instanceof ProviderError) || caught.status !== 404) {
          throw caught;
        }
        await get("System/Info");
      }
      return true;
    },
    getArtists: async () => {
      const params = {
        SortBy: "SortName",
        SortOrder: "Ascending",
        Recursive: "true",
      };
      const data = await get<JellyfinItems>(
        "Artists/AlbumArtists",
        params,
      ).catch(() => get<JellyfinItems>("Artists", params));
      return groupByLetter((data.Items ?? []).map(jellyfinArtist));
    },
    getArtist: async (id) => {
      const data = await items({
        ParentId: id,
        IncludeItemTypes: "MusicAlbum",
        SortBy: "ProductionYear",
        SortOrder: "Descending",
        Recursive: "true",
      });
      return { id, name: "", album: (data.Items ?? []).map(jellyfinAlbum) };
    },
    getAlbum: async (id) => {
      const album = await get<JellyfinItem>(`Items/${encodeURIComponent(id)}`);
      const songs = await items({
        ParentId: id,
        IncludeItemTypes: "Audio",
        SortBy: "IndexNumber",
        SortOrder: "Ascending",
      });
      return jellyfinAlbumDetail(id, album, songs);
    },
    getAlbumList: async (type, size) => {
      const sort = {
        random: "Random",
        recent: "DateCreated",
        frequent: "PlayCount",
        newest: "ProductionYear",
      }[type];
      const data = await items({
        IncludeItemTypes: "MusicAlbum",
        SortBy: sort,
        SortOrder: "Descending",
        Limit: String(size),
        Recursive: "true",
      });
      return (data.Items ?? []).map(jellyfinAlbum);
    },
    search: async (query) =>
      jellyfinSearch(
        await items({
          searchTerm: query,
          Recursive: "true",
          Limit: "30",
          IncludeItemTypes: "MusicArtist,MusicAlbum,Audio",
        }),
      ),
    getPlaylists: async () => {
      const data = await items({
        IncludeItemTypes: "Playlist",
        Recursive: "true",
      });
      return (data.Items ?? []).map((item) => ({
        id: item.Id,
        name: item.Name ?? "",
        songCount: item.ChildCount ?? 0,
      }));
    },
    getPlaylist: async (id) => ({
      id,
      name: "",
      entry: jellyfinSongs(
        await items({ ParentId: id, IncludeItemTypes: "Audio" }),
      ),
    }),
    getRandomSongs: async (size) =>
      jellyfinSongs(
        await items({
          IncludeItemTypes: "Audio",
          SortBy: "Random",
          Limit: String(size),
          Recursive: "true",
        }),
      ),
    coverArtUrl: media.coverArtUrl,
    songToTrack: (song) => ({
      ...baseTrack(song, unknownArtist),
      container: song.container ?? "",
      coverUrl: media.coverArtUrl(song.coverArt || song.albumId),
      streamUrl: media.streamUrl(song.id),
      transcodeUrl: media.transcodeUrl(song.id),
    }),
  };
}

/**
 * As the old app: the library is browsed through the `jf` route (Jellyfin's
 * sign-in, which Emby accepts); only the ping and the media use `emby`.
 */
function emby(unknownArtist: string): RadioProvider {
  const media = jellyfinMedia("emby");
  return {
    ...jellyfin(unknownArtist),
    id: "emby",
    ping: async () => {
      await proxyJson("/provider/emby/System/Info/Public");
      return true;
    },
    coverArtUrl: media.coverArtUrl,
    songToTrack: (song) => ({
      ...baseTrack(song, unknownArtist),
      coverUrl: media.coverArtUrl(song.coverArt || song.albumId),
      streamUrl: media.streamUrl(song.id),
      transcodeUrl: media.transcodeUrl(song.id),
    }),
  };
}

function plex(unknownArtist: string): RadioProvider {
  const get = (path: string, params?: Params) =>
    proxyJson<PlexReply>(`/provider/plex/${path}`, params);
  const base = apiPath("lt", "/subsonic/provider/plex");
  const item = (id: string) => encodeURIComponent(id);
  const coverArtUrl = memoCover(
    (id, size) =>
      `${base}/library/metadata/${item(id)}/thumb?width=${size}&height=${size}`,
  );
  /** What `path` of the music section lists; nothing without one */
  async function inMusic(path: string, params?: Params) {
    const section = plexMusicSection(await get("library/sections"));
    if (!section) return [];
    return plexItems(
      await get(`library/sections/${item(section)}/${path}`, params),
    );
  }

  return {
    ...NO_STARS,
    id: "plex",
    ping: async () => {
      await get("identity");
      return true;
    },
    getArtists: async () =>
      groupByLetter((await inMusic("all")).map(plexArtist)),
    getArtist: async (id) => ({
      id,
      name: "",
      album: plexItems(await get(`library/metadata/${item(id)}/children`)).map(
        plexAlbum,
      ),
    }),
    getAlbum: async (id) => {
      const meta = await get(`library/metadata/${item(id)}`);
      const tracks = await get(`library/metadata/${item(id)}/children`);
      return plexAlbumDetail(id, meta, tracks);
    },
    getAlbumList: async (type, size) => {
      const sort =
        type === "recent"
          ? "addedAt:desc"
          : type === "newest"
            ? "year:desc"
            : "random";
      return (
        await inMusic("albums", {
          sort,
          "X-Plex-Container-Size": String(size),
        })
      ).map(plexAlbum);
    },
    search: async (query) =>
      plexSearch(await get("hubs/search", { query, limit: "20" })),
    getPlaylists: async () =>
      plexItems(await get("playlists", { playlistType: "audio" })).map(
        (entry) => ({
          id: entry.ratingKey,
          name: entry.title ?? "",
          songCount: entry.leafCount ?? 0,
        }),
      ),
    getPlaylist: async (id) => ({
      id,
      name: "",
      entry: plexItems(await get(`playlists/${item(id)}/items`)).map(plexSong),
    }),
    getRandomSongs: async (size) =>
      (
        await inMusic("all", {
          type: "10",
          sort: "random",
          "X-Plex-Container-Size": String(size),
        })
      ).map(plexSong),
    coverArtUrl,
    songToTrack: (song) => ({
      ...baseTrack(song, unknownArtist),
      coverUrl: coverArtUrl(song.coverArt || song.albumId),
      streamUrl: `${base}/library/parts/${item(song.id)}/file`,
      transcodeUrl: `${base}/audio/:/transcode/universal/start?path=/library/metadata/${item(song.id)}&mediaIndex=0&partIndex=0&protocol=http`,
    }),
  };
}

/** The client of the configured provider; Subsonic for an unknown one */
export function createRadioProvider(
  config: ProviderConfig,
  unknownArtist: string,
): RadioProvider {
  switch (config.provider) {
    case "jellyfin":
      return jellyfin(unknownArtist);
    case "plex":
      return plex(unknownArtist);
    case "emby":
      return emby(unknownArtist);
    default:
      return subsonic(config, unknownArtist);
  }
}
