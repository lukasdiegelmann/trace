import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";

import type { Track } from "../lib/radio";
import { next, pause, play, playerStore, playTrack } from "./player";
import { stopRadio } from "./stopRadio";
import { mainAudio, stubMedia } from "./testMedia";

/** Every appended track is 100 s long */
class FakeSourceBuffer extends EventTarget {
  mode = "";
  updating = false;
  timestampOffset = 0;
  end = 0;
  get buffered() {
    const { end } = this;
    return { length: end ? 1 : 0, end: () => end };
  }
  appendBuffer() {
    this.end = this.timestampOffset + 100;
  }
  remove() {
    this.end = 0;
  }
}

class FakeMediaSource extends EventTarget {
  static isTypeSupported = () => true;
  readyState = "closed";
  constructor() {
    super();
    queueMicrotask(() => {
      this.readyState = "open";
      this.dispatchEvent(new Event("sourceopen"));
    });
  }
  addSourceBuffer() {
    return new FakeSourceBuffer();
  }
  endOfStream() {
    this.readyState = "ended";
  }
}

function song(id: string): Track {
  return {
    id,
    title: id,
    artist: "Band",
    album: "",
    duration: 100,
    coverUrl: "",
    streamUrl: `/lt/api/raw/${id}`,
    transcodeUrl: `/lt/api/mp3/${id}`,
  };
}

const queue = ["a", "b", "c", "d"].map(song);
let fetched: string[] = [];
const state = () => playerStore.getSnapshot();

function moveTo(seconds: number) {
  mainAudio().currentTime = seconds;
  mainAudio().dispatchEvent(new Event("timeupdate"));
}

beforeEach(() => {
  fetched = [];
  stubMedia();
  vi.spyOn(api.lt, "get").mockResolvedValue({});
  vi.stubGlobal("MediaSource", FakeMediaSource);
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    return Promise.resolve(new Response(new ArrayBuffer(8)));
  });
  URL.createObjectURL = () => "blob:mse";
  URL.revokeObjectURL = () => undefined;
});

afterEach(() => {
  stopRadio();
  vi.unstubAllGlobals();
});

describe("player with MediaSource", () => {
  it("buffers the transcodes ahead and follows the buffer", async () => {
    await playTrack(queue[0], queue, 0);
    expect(mainAudio().getAttribute("src")).toBe("blob:mse");
    await vi.waitFor(() => {
      expect(fetched).toEqual([
        "/lt/api/mp3/a",
        "/lt/api/mp3/b",
        "/lt/api/mp3/c",
      ]);
    });
    moveTo(100.2);
    expect(state()).toMatchObject({ queueIndex: 1 });
    expect(state().currentTrack?.id).toBe("b");
  });

  it("jumps within the buffer instead of loading again", async () => {
    await playTrack(queue[0], queue, 0);
    await vi.waitFor(() => {
      expect(fetched).toHaveLength(3);
    });
    await next();
    expect(mainAudio().currentTime).toBe(100);
    expect(state().currentTrack?.id).toBe("b");
    expect(fetched.filter((url) => url.endsWith("/b"))).toHaveLength(1);
  });

  it("starts the last track over after the queue has ended", async () => {
    await playTrack(queue[0], queue.slice(0, 1), 0);
    mainAudio().currentTime = 100;
    pause();
    play();
    expect(mainAudio().currentTime).toBe(0);
  });

  it("never puts a station into the buffer", async () => {
    await playTrack(queue[0], queue, 0);
    const station: Track = {
      ...song("live"),
      streamUrl: "/lt/api/radio-proxy?url=x",
      transcodeUrl: null,
      isStream: true,
    };
    await playTrack(station, [station], 0);
    expect(mainAudio().getAttribute("src")).toBe("/lt/api/radio-proxy?url=x");
    expect(fetched).not.toContain("/lt/api/radio-proxy?url=x");
  });

  it("falls back to the plain source when the buffer fails", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 500 })),
    );
    await playTrack(queue[0], queue, 0);
    expect(mainAudio().getAttribute("src")).toBe("/lt/api/raw/a");
  });
});
