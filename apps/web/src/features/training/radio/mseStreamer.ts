/**
 * Gapless playback through MediaSource, after
 * backends/lifttrace/src/lib/mseStreamer.js: every track is appended to one
 * SourceBuffer, so the <audio> element never stops between tracks and a
 * backgrounded tab keeps playing.
 */
import type { Track } from "../lib/radio";
import { DEFAULT_MSE_MIME, type MseOptions } from "../lib/radioPlayback";

export interface MseEntry {
  id: string;
  track: Track;
  /** Where the track begins, in the element's seconds */
  startTime: number;
  duration: number;
}

export interface MseStreamer {
  options: MseOptions;
  attach: (audio: HTMLAudioElement) => Promise<void>;
  /** One after the other; a track already buffered isn't loaded again.
   *  Answers null when a reset or destroy overtook it. */
  appendTrack: (track: Track) => Promise<MseEntry | null>;
  /** Empties the buffer and drops the appends under way */
  reset: () => Promise<void>;
  currentEntry: () => MseEntry | null;
  entryById: (id: string) => MseEntry | null;
  entryAfter: (entry: MseEntry) => MseEntry | null;
  /** Called when the playback position enters another track */
  setOnTrackAdvance: (listener: (track: Track) => void) => void;
  destroy: () => void;
}

export function isMseTypeSupported(mime: string): boolean {
  return (
    typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(mime)
  );
}

export function isMseSupported(): boolean {
  return isMseTypeSupported(DEFAULT_MSE_MIME);
}

export function createMseStreamer(options: MseOptions): MseStreamer {
  let audio: HTMLAudioElement | null = null;
  let mediaSource: MediaSource | null = null;
  let sourceBuffer: SourceBuffer | null = null;
  let objectUrl: string | null = null;
  let opened: Promise<void> = Promise.resolve();
  let entries: MseEntry[] = [];
  let offset = 0;
  let pending: Promise<unknown> = Promise.resolve();
  let generation = 0;
  let controller = new AbortController();
  let announced = -1;
  let onAdvance: ((track: Track) => void) | null = null;
  let isDestroyed = false;

  function currentIndex(): number {
    if (!audio) return -1;
    const time = audio.currentTime;
    return entries.findLastIndex((entry) => time >= entry.startTime);
  }

  function onTimeUpdate(): void {
    const index = currentIndex();
    if (index < 0 || index === announced) return;
    announced = index;
    onAdvance?.(entries[index].track);
  }

  function updateEnd(buffer: SourceBuffer): Promise<void> {
    if (!buffer.updating) return Promise.resolve();
    return new Promise((resolve) => {
      buffer.addEventListener(
        "updateend",
        () => {
          resolve();
        },
        { once: true },
      );
    });
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = pending.then(operation, operation);
    // The caller gets the failure; the chain goes on
    pending = next.catch(() => undefined);
    return next;
  }

  function openBuffer(): SourceBuffer {
    if (!sourceBuffer || mediaSource?.readyState !== "open") {
      throw new Error("MediaSource not open");
    }
    return sourceBuffer;
  }

  return {
    options,
    attach(element) {
      if (isDestroyed) return Promise.reject(new Error("streamer destroyed"));
      audio = element;
      const source = new MediaSource();
      mediaSource = source;
      objectUrl = URL.createObjectURL(source);
      element.src = objectUrl;
      opened = new Promise((resolve, reject) => {
        source.addEventListener(
          "sourceopen",
          () => {
            try {
              sourceBuffer = source.addSourceBuffer(options.mime);
              sourceBuffer.mode = "sequence";
              resolve();
            } catch (caught) {
              reject(
                caught instanceof Error ? caught : new Error(String(caught)),
              );
            }
          },
          { once: true },
        );
        source.addEventListener(
          "error",
          () => {
            reject(new Error("MediaSource error"));
          },
          { once: true },
        );
      });
      element.addEventListener("timeupdate", onTimeUpdate);
      return opened;
    },
    appendTrack(track) {
      const started = generation;
      const isStale = () => isDestroyed || started !== generation;
      return enqueue(async () => {
        if (isStale()) return null;
        const existing = entries.find((entry) => entry.id === track.id);
        if (existing) return existing;
        await opened;
        const url = options.isRaw
          ? track.streamUrl || track.transcodeUrl
          : track.transcodeUrl || track.streamUrl;
        if (!url) throw new Error(`no stream URL for ${track.title}`);
        let data: ArrayBuffer;
        try {
          const response = await fetch(url, {
            credentials: "same-origin",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`fetch ${response.status}`);
          data = await response.arrayBuffer();
        } catch (caught) {
          if (isStale()) return null;
          throw caught;
        }
        if (isStale()) return null;
        const buffer = openBuffer();
        await updateEnd(buffer);
        buffer.timestampOffset = offset;
        buffer.appendBuffer(data);
        await updateEnd(buffer);
        const { buffered } = buffer;
        const end = buffered.length
          ? buffered.end(buffered.length - 1)
          : offset;
        if (end <= offset) throw new Error("nothing was buffered");
        const entry = {
          id: track.id,
          track,
          startTime: offset,
          duration: end - offset,
        };
        offset = end;
        entries.push(entry);
        return entry;
      });
    },
    reset() {
      generation++;
      controller.abort();
      controller = new AbortController();
      return enqueue(async () => {
        if (!sourceBuffer || mediaSource?.readyState !== "open") return;
        await updateEnd(sourceBuffer);
        const { buffered } = sourceBuffer;
        if (buffered.length > 0) {
          sourceBuffer.remove(0, buffered.end(buffered.length - 1));
          await updateEnd(sourceBuffer);
        }
        entries = [];
        offset = 0;
        announced = -1;
      });
    },
    currentEntry: () => entries.at(Math.max(0, currentIndex())) ?? null,
    entryById: (id) => entries.find((entry) => entry.id === id) ?? null,
    entryAfter: (entry) => entries.at(entries.indexOf(entry) + 1) ?? null,
    setOnTrackAdvance(listener) {
      onAdvance = listener;
    },
    destroy() {
      isDestroyed = true;
      generation++;
      controller.abort();
      audio?.removeEventListener("timeupdate", onTimeUpdate);
      try {
        if (mediaSource?.readyState === "open") mediaSource.endOfStream();
      } catch {
        // an update under way: the element gets another source anyway
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      audio = null;
      mediaSource = null;
      sourceBuffer = null;
      entries = [];
    },
  };
}
