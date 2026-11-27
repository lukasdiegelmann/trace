import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";

import type { Track } from "../lib/radio";
import {
  addToQueue,
  cycleRepeat,
  next,
  pause,
  playerStore,
  playNext,
  playTrack,
  prev,
  removeFromQueue,
  setVolume,
  stop,
} from "./player";
import { stopRadio } from "./stopRadio";
import { mainAudio, stubMedia } from "./testMedia";

function song(id: string): Track {
  return {
    id,
    title: `Song ${id}`,
    artist: "Band",
    album: "Album",
    duration: 100,
    coverUrl: "",
    streamUrl: `/lt/api/stream/${id}`,
  };
}

const station: Track = {
  ...song("station:1"),
  streamUrl: "/lt/api/radio-proxy?url=x",
  transcodeUrl: null,
  isStream: true,
  originalUrl: "http://radio.example/live",
};

const queue = [song("a"), song("b"), song("c")];
const state = () => playerStore.getSnapshot();
const source = () => mainAudio().getAttribute("src");

beforeEach(() => {
  stubMedia();
  vi.spyOn(api.lt, "get").mockResolvedValue({});
});

afterEach(() => {
  stopRadio();
  if (state().repeat !== "off") {
    while (state().repeat !== "off") cycleRepeat();
  }
  vi.useRealTimers();
});

describe("player", () => {
  it("creates its audio element only when something plays", async () => {
    await playTrack(queue[0], queue, 0);
    expect(document.querySelectorAll('audio[data-player="main"]')).toHaveLength(
      1,
    );
    expect(source()).toBe("/lt/api/stream/a");
    expect(state()).toMatchObject({ isPlaying: true, queueIndex: 0 });
  });

  it("goes through the queue and pauses at its end", async () => {
    await playTrack(queue[1], queue, 1);
    await next();
    expect(source()).toBe("/lt/api/stream/c");
    await next();
    expect(state()).toMatchObject({ isPlaying: false, queueIndex: 2 });
  });

  it("wraps with repeat all", async () => {
    cycleRepeat();
    await playTrack(queue[2], queue, 2);
    await next();
    expect(state().currentTrack?.id).toBe("a");
  });

  it("starts the same track again with repeat one", async () => {
    cycleRepeat();
    cycleRepeat();
    await playTrack(queue[0], queue, 0);
    mainAudio().currentTime = 90;
    mainAudio().dispatchEvent(new Event("ended"));
    expect(mainAudio().currentTime).toBe(0);
    expect(state().currentTrack?.id).toBe("a");
  });

  it("restarts on previous after 3 s and never wraps", async () => {
    await playTrack(queue[1], queue, 1);
    mainAudio().currentTime = 10;
    prev();
    expect(mainAudio().currentTime).toBe(0);
    prev();
    expect(state().currentTrack?.id).toBe("a");
    prev();
    expect(state().queueIndex).toBe(0);
  });

  it("edits the queue around what plays", async () => {
    await playTrack(queue[0], queue.slice(0, 2), 0);
    playNext(queue[2]);
    addToQueue(song("d"));
    expect(state().queue.map((track) => track.id)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    removeFromQueue(0);
    await vi.waitFor(() => {
      expect(source()).toBe("/lt/api/stream/c");
    });
    expect(state().queueIndex).toBe(0);
  });

  it("keeps the volume on this device", async () => {
    await playTrack(queue[0], queue, 0);
    setVolume(0.8);
    expect(mainAudio().volume).toBe(0.8);
    expect(localStorage.getItem("trace.settings.lt.playerVolume")).toBe("0.8");
  });

  it("forgets the track on stop", async () => {
    await playTrack(queue[0], queue, 0);
    stop();
    expect(state()).toMatchObject({ currentTrack: null, isPlaying: false });
    expect(source()).toBeNull();
  });

  it("plays and pauses with Space, but not from a button or a field", async () => {
    await playTrack(queue[0], queue, 0);
    const press = (target: Element) =>
      target.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
      );
    for (const tag of ["input", "button"]) {
      const element = document.body.appendChild(document.createElement(tag));
      press(element);
      expect(state().isPlaying).toBe(true);
      element.remove();
    }
    press(document.body);
    expect(state().isPlaying).toBe(false);
    press(document.body);
    expect(state().isPlaying).toBe(true);
  });

  it("asks for a station's song every 8 s", async () => {
    vi.useFakeTimers();
    const get = vi
      .spyOn(api.lt, "get")
      .mockResolvedValue({ title: "Band - Now", artwork: "http://a/b.jpg" });
    await playTrack(station, [station], 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toMatchObject({
      streamNowPlaying: "Band - Now",
      streamArtwork: "http://a/b.jpg",
    });
    const polls = () =>
      get.mock.calls.filter(([path]) => path === "/radio-proxy/now-playing")
        .length;
    const before = polls();
    await vi.advanceTimersByTimeAsync(8000);
    expect(polls()).toBe(before + 1);
    stop();
    expect(state().streamNowPlaying).toBe("");
    await vi.advanceTimersByTimeAsync(16_000);
    expect(polls()).toBe(before + 1);
  });

  it("reopens a station that errors, with a cache buster", async () => {
    vi.useFakeTimers();
    await playTrack(station, [station], 0);
    mainAudio().dispatchEvent(new Event("error"));
    expect(source()).toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    expect(source()).toMatch(/^\/lt\/api\/radio-proxy\?url=x&_lr=\d+$/);
  });

  it("doesn't reopen a station the user paused meanwhile", async () => {
    vi.useFakeTimers();
    await playTrack(station, [station], 0);
    mainAudio().dispatchEvent(new Event("error"));
    pause();
    await vi.advanceTimersByTimeAsync(1000);
    expect(source()).toBeNull();
  });

  it("tries the transcode once, then skips to the next track", async () => {
    const first = { ...song("a"), transcodeUrl: "/lt/api/transcode/a" };
    await playTrack(first, [first, queue[1]], 0);
    mainAudio().dispatchEvent(new Event("error"));
    expect(source()).toBe("/lt/api/transcode/a");
    mainAudio().dispatchEvent(new Event("error"));
    await vi.waitFor(() => {
      expect(state().currentTrack?.id).toBe("b");
    });
  });

  it("gives up when every track of the queue fails", async () => {
    await playTrack(queue[0], queue.slice(0, 2), 0);
    cycleRepeat();
    mainAudio().dispatchEvent(new Event("error"));
    await vi.waitFor(() => {
      expect(state().currentTrack?.id).toBe("b");
    });
    mainAudio().dispatchEvent(new Event("error"));
    expect(state()).toMatchObject({ isPlaying: false, queueIndex: 1 });
  });
});
