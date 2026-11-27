/**
 * The fetched library, kept while the app runs so coming back to Radio shows
 * it at once. It belongs to one server and account.
 */
import type {
  Album,
  ArtistGroup,
  Playlist,
  Starred,
} from "../lib/radioProviders";
import {
  createRadioProvider,
  type ProviderConfig,
  type RadioProvider,
} from "./provider";

export interface LibraryData {
  albums: Album[] | null;
  artists: ArtistGroup[] | null;
  playlists: Playlist[] | null;
  starred: Starred | null;
}

export interface LibrarySession {
  key: string;
  client: RadioProvider;
  data: LibraryData;
}

let current: LibrarySession | null = null;

export function getLibrary(
  config: ProviderConfig & { url: string },
  unknownArtist: string,
): LibrarySession {
  const key = JSON.stringify([
    config.provider,
    config.url,
    config.user,
    config.password,
    unknownArtist,
  ]);
  if (current?.key !== key) {
    current = {
      key,
      client: createRadioProvider(config, unknownArtist),
      data: { albums: null, artists: null, playlists: null, starred: null },
    };
  }
  return current;
}

export function cacheLibrary<K extends keyof LibraryData>(
  session: LibrarySession,
  key: K,
  value: LibraryData[K],
): void {
  session.data[key] = value;
}

export function clearLibrary(): void {
  current = null;
}
