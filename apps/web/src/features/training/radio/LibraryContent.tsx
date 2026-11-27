/** The middle of the Radio page for the music tabs, search and details */
import {
  Button,
  Pressable,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import {
  Disc3,
  ListMusic,
  Music,
  Play,
  RotateCcw,
  Shuffle,
  Star,
  User,
  WifiOff,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { fmtDuration, starKey, type RadioTab, type Track } from "../lib/radio";
import type { Album, Artist, Song } from "../lib/radioProviders";
import { fisherYatesShuffle } from "../lib/radioQueue";
import { EmptyNote } from "../common/EmptyNote";
import { playTrack } from "./player";
import { PlayerArt } from "./PlayerArt";
import { TrackMenu } from "./TrackMenu";
import { StarButton, TrackRow, type MenuAt } from "./TrackRow";
import { isLibraryTab, type Library, type LibraryTab } from "./useLibrary";

function SectionTitle({ text }: { text: string }) {
  return (
    <Text variant="label" as="h2">
      {text}
    </Text>
  );
}

interface AlbumGridProps {
  library: Library;
  albums: Album[];
  /** The line below the name */
  subtitle: (album: Album) => string;
}

function AlbumGrid({ library, albums, subtitle }: AlbumGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
      {albums.map((album) => (
        <Pressable
          key={album.id}
          gap={1}
          align="stretch"
          justify="start"
          onPress={() => void library.openAlbum(album)}
        >
          <PlayerArt
            className="aspect-square w-full"
            sources={[
              library.client.coverArtUrl(album.coverArt || album.id, 300),
            ]}
            fallback={<Disc3 className="size-10" />}
          />
          <Text as="span" variant="small" isTruncated>
            {album.name}
          </Text>
          <Text as="span" variant="caption" isTruncated>
            {subtitle(album)}
          </Text>
        </Pressable>
      ))}
    </div>
  );
}

interface LinkRowProps {
  icon: ReactNode;
  text: string;
  detail?: string;
  onPress: () => void;
}

/** An artist or a playlist */
function LinkRow({ icon, text, detail, onPress }: LinkRowProps) {
  return (
    <Pressable shouldGrow onPress={onPress} paddingX={2} paddingY={2}>
      <Row gap={3} align="center">
        <span aria-hidden className="text-accent">
          {icon}
        </span>
        <Stack shouldGrow>
          <Text as="span" isTruncated>
            {text}
          </Text>
        </Stack>
        {detail ? (
          <Text as="span" variant="caption">
            {detail}
          </Text>
        ) : null}
      </Row>
    </Pressable>
  );
}

function SmallCover({ source }: { source: string }) {
  return (
    <PlayerArt
      className="size-11"
      sources={[source]}
      fallback={<Music className="size-4" />}
    />
  );
}

function PlayButtons({ tracks }: { tracks: Track[] }) {
  const { t } = useTranslation("training");
  const start = (queue: Track[]) => {
    const first = queue.at(0);
    if (first) void playTrack(first, queue, 0);
  };
  return (
    <Row gap={2} shouldWrap>
      <Button
        variant="primary"
        size="sm"
        text={t("radio.playAll")}
        isDisabled={tracks.length === 0}
        onClick={() => {
          start(tracks);
        }}
      >
        <Play aria-hidden className="size-4" />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        text={t("radio.shuffle")}
        isDisabled={tracks.length === 0}
        onClick={() => {
          start(fisherYatesShuffle(tracks));
        }}
      >
        <Shuffle aria-hidden className="size-4" />
      </Button>
    </Row>
  );
}

export interface LibraryContentProps {
  library: Library;
  tab: Exclude<RadioTab, "stations">;
}

export function LibraryContent({ library, tab }: LibraryContentProps) {
  const [menu, setMenu] = useState<MenuAt | null>(null);
  return (
    <Stack gap={3}>
      <LibraryView library={library} tab={tab} onMenu={setMenu} />
      <TrackMenu
        at={menu}
        onClose={() => {
          setMenu(null);
        }}
      />
    </Stack>
  );
}

interface LibraryViewProps extends LibraryContentProps {
  onMenu: (at: MenuAt) => void;
}

function LibraryView({ library, tab, onMenu }: LibraryViewProps) {
  const { t } = useTranslation("training");
  const { client, details, data, results, starredIds } = library;

  const starOf = (id: string) =>
    client.hasStars
      ? {
          isStarred: starredIds.has(starKey("song", id)),
          onToggle: () => void library.toggleStar("song", id),
        }
      : undefined;

  const artistMeta = (track: Track) =>
    [track.artist, fmtDuration(track.duration)].filter(Boolean).join(" · ");

  /** Songs with covers; `queueFor` says what plays after the picked one */
  const songRows = (
    songs: Song[],
    queueFor: (tracks: Track[], index: number) => [Track[], number],
  ) => {
    const tracks = songs.map(client.songToTrack);
    return (
      <Stack gap={1}>
        {tracks.map((track, index) => (
          <TrackRow
            key={`${track.id}:${index}`}
            track={track}
            leading={
              <SmallCover
                source={client.coverArtUrl(
                  songs[index]?.coverArt || songs[index]?.albumId,
                  80,
                )}
              />
            }
            meta={artistMeta(track)}
            onPlay={() => {
              const [queue, at] = queueFor(tracks, index);
              void playTrack(track, queue, at);
            }}
            onMenu={onMenu}
            star={starOf(track.id)}
          />
        ))}
      </Stack>
    );
  };

  const artistRows = (artists: Artist[], hasStarButton = false) => (
    <Stack gap={1}>
      {artists.map((artist) => (
        <Row key={artist.id} gap={1} align="center">
          <LinkRow
            icon={<User className="size-5" />}
            text={artist.name}
            detail={
              artist.albumCount
                ? t("radio.albumCount", { count: artist.albumCount })
                : undefined
            }
            onPress={() => void library.openArtist(artist)}
          />
          {hasStarButton ? (
            <StarButton
              name={artist.name}
              isStarred={starredIds.has(starKey("artist", artist.id))}
              onToggle={() => void library.toggleStar("artist", artist.id)}
            />
          ) : null}
        </Row>
      ))}
    </Stack>
  );

  if (library.isLoading) {
    return (
      <Stack align="center" paddingY={8}>
        <Spinner size="lg" label={t("common.loading")} />
      </Stack>
    );
  }

  const { album, artist, playlist } = details;
  if (album) {
    const tracks = (album.song ?? []).map(client.songToTrack);
    return (
      <>
        <Row gap={4} align="center" shouldWrap>
          <PlayerArt
            className="size-28"
            sources={[client.coverArtUrl(album.coverArt || album.id, 400)]}
            fallback={<Disc3 className="size-10" />}
          />
          <Stack gap={2} shouldGrow minWidth={48}>
            <Text variant="heading" as="h2">
              {album.name}
            </Text>
            <Text variant="small" tone="muted">
              {[
                album.artist,
                t("radio.trackCount", {
                  count: album.songCount || tracks.length,
                }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <PlayButtons tracks={tracks} />
          </Stack>
        </Row>
        {tracks.length === 0 ? <EmptyNote text={t("radio.noTracks")} /> : null}
        <Stack gap={1}>
          {tracks.map((track, index) => (
            <TrackRow
              key={`${track.id}:${index}`}
              track={track}
              leading={
                <Text as="span" variant="mono" tone="muted">
                  {index + 1}
                </Text>
              }
              meta={fmtDuration(track.duration)}
              onPlay={() => void playTrack(track, tracks, index)}
              onMenu={onMenu}
              star={starOf(track.id)}
            />
          ))}
        </Stack>
      </>
    );
  }

  if (artist) {
    return (
      <AlbumGrid
        library={library}
        albums={artist.album ?? []}
        subtitle={(entry) => (entry.year ? String(entry.year) : "")}
      />
    );
  }

  if (playlist) {
    const entries = playlist.entry ?? [];
    return (
      <>
        <PlayButtons tracks={entries.map(client.songToTrack)} />
        {entries.length === 0 ? <EmptyNote text={t("radio.noTracks")} /> : null}
        {songRows(entries, (tracks, index) => [tracks, index])}
      </>
    );
  }

  if (tab === "search") {
    return (
      <>
        {results.songs.length > 0 ? (
          <>
            <SectionTitle text={t("radio.songs")} />
            {/* A search result plays on its own */}
            {songRows(results.songs, (tracks, index) => [
              tracks.slice(index, index + 1),
              0,
            ])}
          </>
        ) : null}
        {results.albums.length > 0 ? (
          <>
            <SectionTitle text={t("radio.tabs.albums")} />
            <AlbumGrid
              library={library}
              albums={results.albums}
              subtitle={(entry) => entry.artist ?? ""}
            />
          </>
        ) : null}
        {results.artists.length > 0 ? (
          <>
            <SectionTitle text={t("radio.tabs.artists")} />
            {artistRows(results.artists)}
          </>
        ) : null}
      </>
    );
  }

  if (!isLibraryTab(tab)) return null;

  const emptyNote = (kind: LibraryTab, icon: ReactNode) => {
    if (library.tabError?.tab === kind) {
      return (
        <EmptyNote
          icon={<WifiOff className="size-12" />}
          title={t("radio.unreachable")}
          text={library.tabError.message}
        >
          <Button
            variant="secondary"
            size="sm"
            text={t("common.retry")}
            onClick={() => void library.loadTab(kind, true)}
          >
            <RotateCcw aria-hidden className="size-4" />
          </Button>
        </EmptyNote>
      );
    }
    return <EmptyNote icon={icon} text={t(`radio.empty.${kind}`)} />;
  };

  switch (tab) {
    case "albums": {
      const albums = data.albums ?? [];
      return albums.length > 0 ? (
        <AlbumGrid
          library={library}
          albums={albums}
          subtitle={(entry) => entry.artist ?? ""}
        />
      ) : (
        emptyNote("albums", <Disc3 className="size-12" />)
      );
    }
    case "artists": {
      const artists = (data.artists ?? []).flatMap(
        (group) => group.artist ?? [],
      );
      return artists.length > 0
        ? artistRows(artists)
        : emptyNote("artists", <User className="size-12" />);
    }
    case "playlists": {
      const playlists = data.playlists ?? [];
      return playlists.length > 0 ? (
        <Stack gap={1}>
          {playlists.map((entry) => (
            <LinkRow
              key={entry.id}
              icon={<ListMusic className="size-5" />}
              text={entry.name}
              detail={
                entry.songCount
                  ? t("radio.trackCount", { count: entry.songCount })
                  : undefined
              }
              onPress={() => void library.openPlaylist(entry)}
            />
          ))}
        </Stack>
      ) : (
        emptyNote("playlists", <ListMusic className="size-12" />)
      );
    }
    case "starred": {
      const starred = data.starred;
      if (
        !starred ||
        starred.songs.length +
          starred.albums.length +
          starred.artists.length ===
          0
      ) {
        return emptyNote("starred", <Star className="size-12" />);
      }
      return (
        <>
          {starred.albums.length > 0 ? (
            <>
              <SectionTitle text={t("radio.tabs.albums")} />
              <AlbumGrid
                library={library}
                albums={starred.albums}
                subtitle={(entry) => entry.artist ?? ""}
              />
            </>
          ) : null}
          {starred.artists.length > 0 ? (
            <>
              <SectionTitle text={t("radio.tabs.artists")} />
              {artistRows(starred.artists, true)}
            </>
          ) : null}
          {starred.songs.length > 0 ? (
            <>
              <SectionTitle text={t("radio.songs")} />
              {songRows(starred.songs, (tracks, index) => [tracks, index])}
            </>
          ) : null}
        </>
      );
    }
  }
}
