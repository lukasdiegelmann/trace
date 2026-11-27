import { describe, expect, it } from "vitest";

import {
  createSkipDebounce,
  decideMseOptions,
  isHlsUrl,
  mimeForContainer,
  NO_RECOVERY,
  nextRecovery,
  shouldCrossfade,
  splitArtistTitle,
  STREAM_RECOVER_MAX,
  withCacheBuster,
} from "./radioPlayback";

describe("mimeForContainer", () => {
  it.each([
    ["mp3", "audio/mpeg"],
    ["FLAC", "audio/flac"],
    ["m4a", 'audio/mp4; codecs="mp4a.40.2"'],
    ["mp4", 'audio/mp4; codecs="mp4a.40.2"'],
    ["aac", 'audio/mp4; codecs="mp4a.40.2"'],
    ["ogg", 'audio/ogg; codecs="vorbis"'],
    ["oga", 'audio/ogg; codecs="vorbis"'],
    ["opus", 'audio/webm; codecs="opus"'],
    ["webm", 'audio/webm; codecs="opus"'],
    ["wma", null],
    ["", null],
  ])("maps %j", (container, mime) => {
    expect(mimeForContainer(container)).toBe(mime);
  });
});

describe("decideMseOptions", () => {
  const flac = { container: "flac" };
  const transcoded = { mime: "audio/mpeg", isRaw: false };
  const all = () => true;

  it("transcodes unless the original is wanted and possible", () => {
    expect(decideMseOptions([flac], flac, false, all)).toEqual(transcoded);
    expect(
      decideMseOptions([flac, { container: "mp3" }], flac, true, all),
    ).toEqual(transcoded);
    expect(decideMseOptions([], {}, true, all)).toEqual(transcoded);
    expect(decideMseOptions([flac], flac, true, () => false)).toEqual(
      transcoded,
    );
    expect(decideMseOptions([flac, flac], flac, true, all)).toEqual({
      mime: "audio/flac",
      isRaw: true,
    });
  });
});

describe("shouldCrossfade", () => {
  it("starts within the fade of a long enough track", () => {
    expect(shouldCrossfade(4, 4, 200, false)).toBe(true);
    expect(shouldCrossfade(0, 1, 200, false)).toBe(false);
    expect(shouldCrossfade(4, 5, 200, false)).toBe(false);
    expect(shouldCrossfade(4, 4, 6, false)).toBe(false);
    expect(shouldCrossfade(4, 4, 200, true)).toBe(false);
  });
});

describe("stream recovery", () => {
  it("gives every track 60 tries", () => {
    let state = NO_RECOVERY;
    for (let i = 0; i < STREAM_RECOVER_MAX; i++) {
      const result = nextRecovery(state, "a");
      expect(result.shouldRetry).toBe(true);
      state = result.state;
    }
    expect(nextRecovery(state, "a").shouldRetry).toBe(false);
    expect(nextRecovery(state, "b")).toEqual({
      state: { trackId: "b", count: 1 },
      shouldRetry: true,
    });
  });

  it("busts the cache with the right separator", () => {
    expect(withCacheBuster("/lt/api/radio-proxy?url=x", 5)).toBe(
      "/lt/api/radio-proxy?url=x&_lr=5",
    );
    expect(withCacheBuster("https://a/b.m3u8", 5)).toBe(
      "https://a/b.m3u8?_lr=5",
    );
  });
});

describe("createSkipDebounce", () => {
  it("swallows a second skip within 300 ms", () => {
    const isAllowed = createSkipDebounce();
    expect(isAllowed(1000)).toBe(true);
    expect(isAllowed(1299)).toBe(false);
    expect(isAllowed(1300)).toBe(true);
  });
});

describe("splitArtistTitle", () => {
  it("splits at the first dash, else names the station", () => {
    expect(splitArtistTitle("Band - Song - Live", "FM")).toEqual({
      artist: "Band",
      title: "Song - Live",
    });
    expect(splitArtistTitle("Just a show", "FM")).toEqual({
      artist: "FM",
      title: "Just a show",
    });
    expect(splitArtistTitle("", "FM")).toEqual({ artist: "FM", title: "FM" });
    expect(splitArtistTitle(" - x", "FM")).toEqual({
      artist: "FM",
      title: " - x",
    });
  });
});

describe("isHlsUrl", () => {
  it("looks at the path's ending", () => {
    expect(isHlsUrl("https://a/live.M3U8")).toBe(true);
    expect(isHlsUrl("https://a/live.m3u8?token=1")).toBe(true);
    expect(isHlsUrl("https://a/live.m3u")).toBe(false);
    expect(isHlsUrl(undefined)).toBe(false);
  });
});
