/** What the music tabs of the Radio page show, and how it is fetched */
import { useToast } from "@monocircuit/monolithium/components";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  starArgs,
  starKey,
  starredIdSet,
  type RadioTab,
  type SelectedItem,
  type StarKind,
} from "../lib/radio";
import type {
  AlbumDetail,
  ArtistDetail,
  PlaylistDetail,
  SearchResults,
} from "../lib/radioProviders";
import {
  cacheLibrary,
  type LibraryData,
  type LibrarySession,
} from "./libraryCache";
import { playTrack } from "./player";
import { ProviderError } from "./provider";

export type LibraryTab = Extract<
  RadioTab,
  "albums" | "artists" | "playlists" | "starred"
>;

export function isLibraryTab(tab: RadioTab): tab is LibraryTab {
  return tab !== "stations" && tab !== "search";
}

export interface Details {
  album: AlbumDetail | null;
  artist: ArtistDetail | null;
  playlist: PlaylistDetail | null;
}

const NO_DETAILS: Details = { album: null, artist: null, playlist: null };

const NO_RESULTS: SearchResults = { artists: [], albums: [], songs: [] };

function hasContent(data: LibraryData, tab: LibraryTab): boolean {
  if (tab === "starred") {
    const { starred } = data;
    return Boolean(
      starred &&
      starred.songs.length + starred.albums.length + starred.artists.length > 0,
    );
  }
  return Boolean(data[tab]?.length);
}

export function useLibrary(session: LibrarySession) {
  const { t } = useTranslation("training");
  const toast = useToast();
  const { client } = session;

  const [data, setData] = useState<LibraryData>(() => ({ ...session.data }));
  const [details, setDetails] = useState<Details>(NO_DETAILS);
  const [isLoading, setIsLoading] = useState(false);
  const [tabError, setTabError] = useState<{
    tab: LibraryTab;
    message: string;
  } | null>(null);
  const [results, setResults] = useState<SearchResults>(NO_RESULTS);
  const [starredIds, setStarredIds] = useState<ReadonlySet<string>>(() =>
    session.data.starred
      ? starredIdSet(session.data.starred)
      : new Set<string>(),
  );
  /** Goes up with every request; the answer of an older one is dropped */
  const request = useRef(0);

  const messageOf = useCallback(
    (caught: unknown): string => {
      if (
        caught instanceof ProviderError &&
        caught.message === `API error ${caught.status}`
      ) {
        return t("radio.apiError", { status: caught.status });
      }
      return caught instanceof Error ? caught.message : String(caught);
    },
    [t],
  );

  /** Runs one request with the spinner; false when it failed or was overtaken */
  const run = useCallback(
    async <T>(
      load: () => Promise<T>,
      apply: (value: T) => void,
      fail: (message: string) => void = (message) => toast.error(message),
    ): Promise<boolean> => {
      const mine = ++request.current;
      setIsLoading(true);
      try {
        const value = await load();
        if (mine !== request.current) return false;
        apply(value);
        setIsLoading(false);
        return true;
      } catch (caught) {
        if (mine !== request.current) return false;
        setIsLoading(false);
        fail(messageOf(caught));
        return false;
      }
    },
    [messageOf, toast],
  );

  const cancel = useCallback(() => {
    request.current++;
    setIsLoading(false);
  }, []);

  const store = useCallback(
    <K extends keyof LibraryData>(key: K, value: LibraryData[K]) => {
      cacheLibrary(session, key, value);
      setData((before) => ({ ...before, [key]: value }));
    },
    [session],
  );

  const loadTab = useCallback(
    (tab: LibraryTab, shouldForce = false): Promise<boolean> => {
      setTabError(null);
      // What is cached shows at once; the cache may have been emptied
      if (!shouldForce && hasContent(session.data, tab)) {
        cancel();
        setData({ ...session.data });
        return Promise.resolve(true);
      }
      const fail = (message: string) => {
        setTabError({ tab, message });
        toast.error(
          t("radio.toast.loadFailed", {
            tab: t(`radio.tabs.${tab}`),
            message,
          }),
        );
      };
      switch (tab) {
        case "albums":
          return run(
            () => client.getAlbumList("random", 50),
            (albums) => {
              store("albums", albums);
            },
            fail,
          );
        case "artists":
          return run(
            () => client.getArtists(),
            (artists) => {
              store("artists", artists);
              if (artists.length === 0) {
                toast.error(t("radio.toast.noArtists"));
              }
            },
            fail,
          );
        case "playlists":
          return run(
            () => client.getPlaylists(),
            (playlists) => {
              store("playlists", playlists);
            },
            fail,
          );
        case "starred":
          return run(
            () => client.getStarred(),
            (starred) => {
              store("starred", starred);
              setStarredIds(starredIdSet(starred));
            },
            fail,
          );
      }
    },
    [cancel, client, run, session, store, t, toast],
  );

  /** The favorites' ids, so stars are right in every list. Quiet. */
  const preloadStars = useCallback(async () => {
    if (!client.hasStars) return;
    try {
      const starred = await client.getStarred();
      store("starred", starred);
      setStarredIds(starredIdSet(starred));
    } catch {
      // the stars stay empty
    }
  }, [client, store]);

  // Some servers' details come without a name: keep the one that was picked
  const openAlbum = useCallback(
    ({ id }: { id: string }) =>
      run(
        () => client.getAlbum(id),
        (album) => {
          setDetails((before) => ({ ...before, album }));
        },
      ),
    [client, run],
  );

  const openArtist = useCallback(
    ({ id, name }: SelectedItem) =>
      run(
        () => client.getArtist(id),
        (artist) => {
          setDetails((before) => ({
            ...before,
            artist: { ...artist, id, name: artist.name || name },
          }));
        },
      ),
    [client, run],
  );

  const openPlaylist = useCallback(
    ({ id, name }: SelectedItem) =>
      run(
        () => client.getPlaylist(id),
        (playlist) => {
          setDetails((before) => ({
            ...before,
            playlist: { ...playlist, id, name: playlist.name || name },
          }));
        },
      ),
    [client, run],
  );

  /** One step: the album first, then the artist, then the playlist */
  const back = useCallback(() => {
    cancel();
    setDetails((before) => {
      if (before.album) return { ...before, album: null };
      if (before.artist) return { ...before, artist: null };
      return { ...before, playlist: null };
    });
  }, [cancel]);

  const closeDetails = useCallback(() => {
    cancel();
    setDetails(NO_DETAILS);
  }, [cancel]);

  const search = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed) void run(() => client.search(trimmed), setResults);
    },
    [client, run],
  );

  const playMix = useCallback(() => {
    void run(
      () => client.getRandomSongs(50),
      (songs) => {
        const tracks = songs.map(client.songToTrack);
        const first = tracks.at(0);
        if (first) void playTrack(first, tracks, 0);
      },
    );
  }, [client, run]);

  /** Flips the star at once and flips it back when the server refuses */
  const toggleStar = useCallback(
    async (kind: StarKind, id: string) => {
      const key = starKey(kind, id);
      const isStarred = starredIds.has(key);
      const set = (isOn: boolean) => {
        setStarredIds((before) => {
          const next = new Set(before);
          if (isOn) next.add(key);
          else next.delete(key);
          return next;
        });
      };
      set(!isStarred);
      try {
        await (isStarred ? client.unstar : client.star)(starArgs(kind, id));
        // The Starred tab fetches again on its next visit
        cacheLibrary(session, "starred", null);
      } catch (caught) {
        set(isStarred);
        toast.error(messageOf(caught) || t("radio.toast.cantUpdateFavorite"));
      }
    },
    [client, messageOf, session, starredIds, t, toast],
  );

  return {
    client,
    data,
    details,
    isLoading,
    tabError,
    results,
    starredIds,
    loadTab,
    preloadStars,
    openAlbum,
    openArtist,
    openPlaylist,
    back,
    closeDetails,
    cancel,
    search,
    playMix,
    toggleStar,
  };
}

export type Library = ReturnType<typeof useLibrary>;
