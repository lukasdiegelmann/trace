import { describe, expect, it } from "vitest";

import {
  groupByLetter,
  jellyfinAlbum,
  jellyfinAlbumDetail,
  jellyfinArtist,
  jellyfinSearch,
  plexAlbumDetail,
  plexMusicSection,
  plexSearch,
} from "./radioProviders";

describe("Jellyfin", () => {
  it("groups artists by their first letter", () => {
    const artists = [
      { Id: "1", Name: "abba", AlbumCount: 2 },
      { Id: "2", Name: "Air" },
      { Id: "3" },
    ].map(jellyfinArtist);
    expect(groupByLetter(artists)).toEqual([
      { name: "A", artist: [artists[0], artists[1]] },
      { name: "?", artist: [artists[2]] },
    ]);
  });

  it("maps an album with its songs", () => {
    expect(
      jellyfinAlbumDetail(
        "al",
        { Id: "al", Name: "Moon Safari", AlbumArtist: "Air" },
        {
          Items: [
            {
              Id: "s1",
              Name: "La femme",
              Artists: ["Air"],
              RunTimeTicks: 4_290_000_000,
              Container: "FLAC",
            },
          ],
        },
      ),
    ).toEqual({
      id: "al",
      name: "Moon Safari",
      artist: "Air",
      coverArt: "al",
      songCount: 1,
      song: [
        {
          id: "s1",
          title: "La femme",
          artist: "Air",
          album: "Moon Safari",
          albumId: "al",
          duration: 429,
          coverArt: "al",
          container: "flac",
        },
      ],
    });
    expect(
      jellyfinAlbum({ Id: "x", Name: "N", Artist: "R", ProductionYear: 1998 }),
    ).toEqual({
      id: "x",
      name: "N",
      artist: "R",
      year: 1998,
      coverArt: "x",
    });
  });

  it("sorts search hits by type", () => {
    const found = jellyfinSearch({
      Items: [
        { Id: "1", Name: "A", Type: "MusicArtist" },
        { Id: "2", Name: "B", Type: "MusicAlbum" },
        { Id: "3", Name: "C", Type: "Audio", AlbumId: "2" },
        { Id: "4", Type: "Movie" },
      ],
    });
    expect(found.artists).toEqual([{ id: "1", name: "A" }]);
    expect(found.albums.map((album) => album.id)).toEqual(["2"]);
    expect(found.songs).toMatchObject([{ id: "3", coverArt: "2" }]);
  });
});

describe("Plex", () => {
  it("finds the music section", () => {
    expect(
      plexMusicSection({
        MediaContainer: {
          Directory: [
            { key: "1", type: "movie" },
            { key: "2", type: "artist" },
          ],
        },
      }),
    ).toBe("2");
    expect(plexMusicSection({})).toBeNull();
  });

  it("maps an album with millisecond durations", () => {
    const detail = plexAlbumDetail(
      "9",
      {
        MediaContainer: {
          Metadata: [{ ratingKey: "9", title: "T", parentTitle: "R" }],
        },
      },
      {
        MediaContainer: {
          Metadata: [
            {
              ratingKey: "10",
              title: "S",
              originalTitle: "Guest",
              duration: 61_400,
            },
          ],
        },
      },
    );
    expect(detail).toMatchObject({ name: "T", artist: "R", songCount: 1 });
    expect(detail.song).toMatchObject([
      { id: "10", artist: "Guest", duration: 61, albumId: "9", album: "T" },
    ]);
  });

  it("reads the search hubs", () => {
    const found = plexSearch({
      MediaContainer: {
        Hub: [
          { type: "artist", Metadata: [{ ratingKey: "1", title: "A" }] },
          {
            type: "track",
            Metadata: [{ ratingKey: "3", title: "C", parentRatingKey: "2" }],
          },
        ],
      },
    });
    expect(found.artists).toEqual([{ id: "1", name: "A" }]);
    expect(found.albums).toEqual([]);
    expect(found.songs).toMatchObject([{ id: "3", coverArt: "2" }]);
  });
});
