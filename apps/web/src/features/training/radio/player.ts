/**
 * The music player, after backends/lifttrace/src/stores/player.js (web
 * paths only): a module-level store that owns one <audio> element, so
 * playback survives navigation. Read it with `usePlayer` (usePlayer.ts).
 * Nothing touches the DOM before the first playback.
 */
import { settingsStores } from "@/features/shared/settings";

import type { Track } from "../lib/radio";
import { parseId3, sanitizeTitle } from "../lib/radioIcy";
import {
  createSkipDebounce,
  decideMseOptions,
  isHlsUrl,
  NO_RECOVERY,
  nextRecovery,
  shouldCrossfade,
  splitArtistTitle,
  STREAM_RECOVER_DELAY_MS,
  withCacheBuster,
} from "../lib/radioPlayback";
import {
  addToQueue as appended,
  cycleRepeat as nextRepeatMode,
  insertNext,
  isRepeatMode,
  moveInQueue as moved,
  peekNextIndex,
  prevAction,
  removeFromQueue as removed,
  type RepeatMode,
} from "../lib/radioQueue";
import { fetchNowPlaying } from "./api";
import {
  createMseStreamer,
  isMseSupported,
  isMseTypeSupported,
  type MseStreamer,
} from "./mseStreamer";

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  /** 0 to 1, within the track */
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeat: RepeatMode;
  isQueueShown: boolean;
  isBuffering: boolean;
  /** The song a station says it is playing */
  streamNowPlaying: string;
  /** Its cover, when the station sends one */
  streamArtwork: string;
}

const TICK_MS = 250;
const NOW_PLAYING_POLL_MS = 8000;
const PREFETCH_BEFORE_END = 15;
const MSE_APPEND_BEFORE_END = 8;
const SEEK_STEP = 10;

/** Settings of this device only; they never go to the server */
const DEVICE_PREFIX = "trace.settings.lt.";

function readDevice(key: string): unknown {
  try {
    const raw = localStorage.getItem(DEVICE_PREFIX + key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

function writeDevice(key: string, value: unknown): void {
  try {
    localStorage.setItem(DEVICE_PREFIX + key, JSON.stringify(value));
  } catch {
    // blocked storage: the value lasts for this session
  }
}

function initialState(): PlayerState {
  const volume = readDevice("playerVolume");
  const repeat = readDevice("playerRepeat");
  return {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    volume: typeof volume === "number" ? volume : 0.5,
    isShuffle: readDevice("playerShuffle") === true,
    repeat: isRepeatMode(repeat) ? repeat : "off",
    isQueueShown: false,
    isBuffering: false,
    streamNowPlaying: "",
    streamArtwork: "",
  };
}

let state = initialState();
const listeners = new Set<() => void>();

function update(patch: Partial<PlayerState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export const playerStore = {
  getSnapshot: (): PlayerState => state,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function queued(index: number): Track | undefined {
  return index < 0 ? undefined : state.queue.at(index);
}

let audio: HTMLAudioElement | null = null;
let hasGlobalListeners = false;
/** Goes up with every new playback; async steps of an older one give up */
let session = 0;

function hasMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

function setPlaybackState(value: MediaSessionPlaybackState): void {
  if (hasMediaSession()) navigator.mediaSession.playbackState = value;
}

function playSafely(element: HTMLAudioElement): Promise<void> {
  return Promise.resolve(element.play()).catch((caught: unknown) => {
    console.warn("[player] play() rejected:", caught);
    // Autoplay refused: no "pause" event follows
    if (caught instanceof Error && caught.name === "NotAllowedError") {
      update({ isPlaying: false });
    }
  });
}

function hiddenAudio(): HTMLAudioElement {
  const element = document.createElement("audio");
  element.hidden = true;
  element.setAttribute("playsinline", "true");
  element.setAttribute("webkit-playsinline", "true");
  // In the page: browsers suspend detached audio sooner in the background
  document.body.appendChild(element);
  return element;
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  const element = hiddenAudio();
  element.dataset.player = "main";
  element.volume = state.volume;
  element.addEventListener("play", () => {
    setPlaybackState("playing");
    update({ isPlaying: true });
    startTicks();
  });
  element.addEventListener("playing", () => {
    failedInARow = 0;
  });
  element.addEventListener("pause", () => {
    setPlaybackState("paused");
    update({ isPlaying: false });
    stopTicks();
  });
  element.addEventListener("ended", onEnded);
  const onDuration = () => {
    if (mse) return;
    update({
      duration: Number.isFinite(element.duration) ? element.duration : 0,
    });
  };
  element.addEventListener("loadedmetadata", onDuration);
  element.addEventListener("durationchange", onDuration);
  element.addEventListener("error", onError);
  audio = element;
  addGlobalListeners();
  return element;
}

/** For a Web Audio analyser; null until something has played */
export function getAudioForAnalyser(): HTMLAudioElement | null {
  return audio;
}

// ── HLS ─────────────────────────────────────────────────────────────────

interface HlsHandle {
  destroy: () => void;
}

let hls: HlsHandle | null = null;

function destroyHls(): void {
  hls?.destroy();
  hls = null;
}

async function attachHls(
  element: HTMLAudioElement,
  url: string,
  started: number,
): Promise<void> {
  destroyHls();
  try {
    const { default: Hls } = await import("hls.js");
    if (started !== session) return;
    if (Hls.isSupported()) {
      const instance = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls = instance;
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        void playSafely(element);
      });
      // HLS stations put "now playing" into ID3 tags of the segments
      instance.on(Hls.Events.FRAG_PARSING_METADATA, (_event, data) => {
        for (const sample of data.samples) {
          const raw = parseId3(sample.data);
          if (!raw) continue;
          const title = sanitizeTitle(raw);
          if (title && title !== state.streamNowPlaying) {
            update({ streamNowPlaying: title });
            updateStreamMediaSession(title, "");
          }
          break;
        }
      });
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        console.warn("[player] HLS fatal error:", data.type, data.details);
        if (hls === instance) {
          destroyHls();
          update({ isPlaying: false });
        }
      });
      instance.loadSource(url);
      instance.attachMedia(element);
      return;
    }
  } catch (caught) {
    console.warn("[player] hls.js failed:", caught);
    if (started !== session) return;
  }
  // Safari plays HLS itself
  element.src = url;
  await playSafely(element);
}

// ── Errors ──────────────────────────────────────────────────────────────

let recovery = NO_RECOVERY;
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
let transcodeTriedFor: string | null = null;
let failedInARow = 0;

function cancelRecovery(): void {
  clearTimeout(recoveryTimer);
  recoveryTimer = undefined;
}

function unload(element: HTMLAudioElement): void {
  element.removeAttribute("src");
  element.load();
}

function onError(): void {
  const element = audio;
  const track = state.currentTrack;
  // An error of a source that was just taken away says nothing
  if (!element || !track || (!element.getAttribute("src") && !hls)) return;
  console.warn("[player] audio error:", element.error?.code);

  // A live stream: a fresh source opens a fresh decoder
  if (track.isStream && track.streamUrl) {
    const next = nextRecovery(recovery, track.id);
    recovery = next.state;
    if (next.shouldRetry) {
      const started = session;
      destroyHls();
      element.pause();
      unload(element);
      cancelRecovery();
      recoveryTimer = setTimeout(() => {
        recoveryTimer = undefined;
        if (started !== session || state.currentTrack?.id !== track.id) return;
        if (isHlsUrl(track.streamUrl)) {
          void attachHls(element, track.streamUrl, started);
          return;
        }
        element.src = withCacheBuster(track.streamUrl, Date.now());
        void playSafely(element);
      }, STREAM_RECOVER_DELAY_MS);
      return;
    }
  }

  if (track.transcodeUrl && transcodeTriedFor !== track.id) {
    transcodeTriedFor = track.id;
    resetMse();
    element.src = track.transcodeUrl;
    void playSafely(element);
    return;
  }

  // One bad file must not stall the queue; a dead server must not spin it
  failedInARow++;
  if (state.queue.length > 1 && failedInARow < state.queue.length) {
    void next();
  } else {
    update({ isPlaying: false, isBuffering: false });
    stopTicks();
  }
}

// ── Shuffle commit ──────────────────────────────────────────────────────

/** The committed "next up" of shuffle, so prefetch and advance agree */
let shuffleNext = -1;

function peekNext(from: number = state.queueIndex): number {
  const found = peekNextIndex({
    length: state.queue.length,
    index: from,
    isShuffle: state.isShuffle,
    repeat: state.repeat,
    shuffleNext,
  });
  shuffleNext = found.shuffleNext;
  return found.index;
}

function consumeNext(): number {
  const index = peekNext();
  shuffleNext = -1;
  return index;
}

// ── MSE (gapless, for tracks with a transcode URL) ──────────────────────

let mse: MseStreamer | null = null;
let isMseAppending = false;
/** While a track is being appended to switch to it */
let isMseSwitching = false;

function resetMse(): void {
  mse?.destroy();
  mse = null;
  isMseAppending = false;
  isMseSwitching = false;
  if (state.isBuffering) update({ isBuffering: false });
}

function onMseAdvance(track: Track): void {
  const current = state.currentTrack;
  // Jumps set the current track first; only the buffer flowing on gets here
  if (!mse || !audio || isMseSwitching || track.id === current?.id) return;
  if (state.repeat === "one" && current) {
    const entry = mse.entryById(current.id);
    if (entry) {
      audio.currentTime = entry.startTime;
      return;
    }
  }
  const expected = peekNext();
  if (expected < 0) {
    pause();
    return;
  }
  // The queue changed after the buffer was filled
  const following = queued(expected);
  if (following?.id !== track.id) {
    void next();
    return;
  }
  shuffleNext = -1;
  update({ queueIndex: expected, currentTrack: following });
  updateMediaSession(following);
}

/** Keeps the buffer ahead: one track in shuffle, else two. No spinner. */
async function appendAhead(): Promise<void> {
  const streamer = mse;
  if (!streamer || isMseAppending || state.repeat === "one") return;
  isMseAppending = true;
  let index = state.queueIndex;
  for (let i = 0; i < (state.isShuffle ? 1 : 2); i++) {
    index = peekNext(index);
    const track = queued(index);
    if (!track?.transcodeUrl || mse !== streamer) break;
    try {
      if (!(await streamer.appendTrack(track))) break;
    } catch (caught) {
      console.warn("[player] MSE append-ahead failed:", caught);
      break;
    }
    if (state.isShuffle) break;
  }
  if (mse === streamer) isMseAppending = false;
}

/** Appends `track` (if needed) and jumps to it; false when overtaken */
async function mseSwitchTo(
  streamer: MseStreamer,
  track: Track,
  element: HTMLAudioElement,
  started: number,
): Promise<boolean> {
  isMseSwitching = true;
  let entry = streamer.entryById(track.id);
  if (!entry) {
    update({ isBuffering: true });
    try {
      entry = await streamer.appendTrack(track);
    } finally {
      if (started === session) update({ isBuffering: false });
    }
  }
  if (started !== session || mse !== streamer) return false;
  isMseSwitching = false;
  if (!entry) throw new Error("the track was not buffered");
  update({ currentTrack: track });
  element.currentTime = entry.startTime;
  updateMediaSession(track);
  void appendAhead();
  await playSafely(element);
  return true;
}

function mseOptionsFor(track: Track) {
  return decideMseOptions(
    state.queue,
    track,
    settingsStores.lt.get("radioOriginalFormat"),
    isMseTypeSupported,
  );
}

/** True once MSE has taken the playback (or a newer one has) */
async function playThroughMse(
  track: Track,
  element: HTMLAudioElement,
  isNewQueue: boolean,
  started: number,
): Promise<boolean> {
  if (!track.transcodeUrl || !isMseSupported()) {
    // A station must never be loaded into the buffer: it has no end
    resetMse();
    return false;
  }
  try {
    const options = mseOptionsFor(track);
    if (
      mse &&
      isNewQueue &&
      (mse.options.mime !== options.mime || mse.options.isRaw !== options.isRaw)
    ) {
      resetMse();
    }
    let streamer = mse;
    const isFresh = !streamer;
    if (!streamer) {
      streamer = createMseStreamer(options);
      mse = streamer;
      streamer.setOnTrackAdvance(onMseAdvance);
      isMseSwitching = true;
      await streamer.attach(element);
    }
    if (started !== session) return true;
    isMseAppending = false;
    if (isNewQueue && !isFresh) {
      isMseSwitching = true;
      await streamer.reset();
      if (started !== session) return true;
    }
    await mseSwitchTo(streamer, track, element, started);
    return true;
  } catch (caught) {
    if (started !== session) return true;
    console.warn("[player] MSE failed, falling back to src:", caught);
    resetMse();
    return false;
  }
}

// ── Prefetch of the next track (without MSE) ────────────────────────────

let prefetchAudio: HTMLAudioElement | null = null;
let hasPrefetchedNearEnd = false;

function prefetchNext(): void {
  if (mse) return;
  const track = queued(peekNext());
  const url = track && (track.streamUrl || track.transcodeUrl);
  if (!url || track.isStream) return;
  if (!prefetchAudio) {
    prefetchAudio = hiddenAudio();
    prefetchAudio.dataset.player = "prefetch";
    prefetchAudio.preload = "auto";
  }
  if (prefetchAudio.getAttribute("src") === url) return;
  prefetchAudio.src = url;
  prefetchAudio.load();
}

function clearPrefetch(): void {
  if (!prefetchAudio?.getAttribute("src")) return;
  unload(prefetchAudio);
}

// ── Crossfade (without MSE), through a second element ───────────────────

let fadeAudio: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | undefined;
let isCrossfading = false;

function cancelCrossfade(): void {
  clearInterval(fadeTimer);
  if (fadeAudio) {
    fadeAudio.pause();
    fadeAudio.removeAttribute("src");
    fadeAudio = null;
  }
  if (isCrossfading && audio) audio.volume = state.volume;
  isCrossfading = false;
}

function startCrossfade(seconds: number): void {
  const index = consumeNext();
  const track = queued(index);
  if (!track) return;
  isCrossfading = true;
  const incoming = document.createElement("audio");
  incoming.volume = 0;
  incoming.src = track.streamUrl;
  fadeAudio = incoming;
  void playSafely(incoming);

  const steps = seconds * 20;
  let step = 0;
  fadeTimer = setInterval(() => {
    step++;
    const share = Math.min(1, step / steps);
    if (audio) audio.volume = state.volume * (1 - share);
    incoming.volume = state.volume * share;
    if (step < steps) return;
    const source = incoming.src;
    const position = incoming.currentTime;
    cancelCrossfade();
    if (!audio) return;
    hasPrefetchedNearEnd = false;
    update({ queueIndex: index, currentTrack: track });
    // The faded-in stream moves into the main element (mobile browsers
    // only keep playing what the user started)
    audio.src = source;
    audio.currentTime = position;
    audio.volume = state.volume;
    updateMediaSession(track);
    void playSafely(audio);
  }, 50);
}

function onEnded(): void {
  if (isCrossfading) return;
  if (state.repeat === "one" && audio) {
    audio.currentTime = 0;
    void playSafely(audio);
    return;
  }
  void next();
}

// ── Progress ────────────────────────────────────────────────────────────

let tickTimer: ReturnType<typeof setInterval> | undefined;
let ticks = 0;

function stopTicks(): void {
  clearInterval(tickTimer);
  tickTimer = undefined;
}

function startTicks(): void {
  stopTicks();
  ticks = 0;
  tickTimer = setInterval(tick, TICK_MS);
}

/** About once a second */
function tickPositionState(): void {
  if (++ticks >= 4) {
    ticks = 0;
    updatePositionState();
  }
}

function tick(): void {
  const element = audio;
  if (!element || element.paused) return;
  if (mse) {
    if (isMseSwitching) return;
    const entry = mse.currentEntry();
    if (!entry || entry.duration <= 0) return;
    const position = element.currentTime - entry.startTime;
    const remaining = entry.duration - position;
    update({
      currentTime: position,
      duration: entry.duration,
      progress: Math.max(0, Math.min(1, position / entry.duration)),
    });
    if (remaining <= MSE_APPEND_BEFORE_END && remaining > 0) {
      void appendAhead();
    }
    // The end of the buffer fires no "ended": repeat, wrap or stop here
    if (remaining <= 0.1 && !isMseAppending && !mse.entryAfter(entry)) {
      if (state.repeat === "one") element.currentTime = entry.startTime;
      else if (peekNext() < 0) pause();
      else void next();
    }
    tickPositionState();
    return;
  }

  const { duration } = element;
  if (!Number.isFinite(duration) || duration <= 0) {
    update({ currentTime: element.currentTime, progress: 0 });
    return;
  }
  update({
    currentTime: element.currentTime,
    progress: element.currentTime / duration,
  });
  tickPositionState();
  const remaining = duration - element.currentTime;
  const fade = settingsStores.lt.get("radioCrossfade") || 0;
  if (
    state.repeat !== "one" &&
    shouldCrossfade(fade, remaining, duration, isCrossfading)
  ) {
    startCrossfade(fade);
  }
  if (
    !hasPrefetchedNearEnd &&
    remaining <= PREFETCH_BEFORE_END &&
    remaining > 0
  ) {
    hasPrefetchedNearEnd = true;
    prefetchNext();
  }
}

// ── Media Session ───────────────────────────────────────────────────────

function artwork(url: string): MediaImage[] {
  if (!url) return [];
  return ["96x96", "192x192", "512x512"].map((sizes) => ({
    src: url,
    sizes,
    type: "image/jpeg",
  }));
}

function setMetadata(metadata: MediaMetadataInit): void {
  if (!hasMediaSession() || typeof MediaMetadata === "undefined") return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata(metadata);
  } catch {
    // e.g. an artwork URL the browser refuses
  }
}

function updateMediaSession(track: Track | undefined): void {
  if (!track) return;
  setMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: artwork(track.coverUrl),
  });
  updatePositionState();
}

/** A station's current song: "Artist - Song" stacked on the lock screen */
function updateStreamMediaSession(title: string, cover: string): void {
  const track = state.currentTrack;
  if (!track?.isStream) return;
  setMetadata({
    ...splitArtistTitle(title, track.title),
    album: track.title,
    artwork: artwork(cover || track.coverUrl),
  });
}

function updatePositionState(): void {
  if (!audio || !hasMediaSession()) return;
  if (!("setPositionState" in navigator.mediaSession)) return;
  const entry = mse?.currentEntry();
  const duration = mse ? (entry?.duration ?? 0) : audio.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const position = audio.currentTime - (mse ? (entry?.startTime ?? 0) : 0);
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.max(0, Math.min(duration, position)),
    });
  } catch {
    // inconsistent values while the source changes
  }
}

const isSkipAllowed = createSkipDebounce();

function debouncedNext(): void {
  if (isSkipAllowed(Date.now())) void next();
}

function debouncedPrev(): void {
  if (isSkipAllowed(Date.now())) prev();
}

/** The part of the element's timeline that is the current track */
function segment(): { start: number; end: number } {
  const entry = mse?.currentEntry();
  if (entry) {
    return { start: entry.startTime, end: entry.startTime + entry.duration };
  }
  return { start: 0, end: audio?.duration || Number.POSITIVE_INFINITY };
}

function seekBy(seconds: number): void {
  if (!audio) return;
  const { start, end } = segment();
  audio.currentTime = Math.max(
    start,
    Math.min(end, audio.currentTime + seconds),
  );
  updatePositionState();
}

function seekTo(details: MediaSessionActionDetails): void {
  if (!audio || details.seekTime === undefined) return;
  const entry = mse?.currentEntry();
  const target = entry
    ? entry.startTime + Math.max(0, Math.min(entry.duration, details.seekTime))
    : details.seekTime;
  if (details.fastSeek && "fastSeek" in audio) {
    audio.fastSeek(target);
    return;
  }
  audio.currentTime = target;
  updatePositionState();
}

function registerMediaSessionHandlers(): void {
  if (!hasMediaSession()) return;
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", play],
    ["pause", pause],
    ["stop", stop],
    ["previoustrack", debouncedPrev],
    ["nexttrack", debouncedNext],
    [
      "seekbackward",
      (details) => {
        seekBy(-(details.seekOffset || SEEK_STEP));
      },
    ],
    [
      "seekforward",
      (details) => {
        seekBy(details.seekOffset || SEEK_STEP);
      },
    ],
    ["seekto", seekTo],
  ];
  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // an action this browser doesn't know
    }
  }
}

// ── Keyboard and backgrounding ──────────────────────────────────────────

const TYPING =
  "input, textarea, select, [contenteditable]:not([contenteditable=false])";
/** Where Space already does something */
const PRESSABLE =
  'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role^="menuitem"], [role="slider"]';

function onKeyDown(event: KeyboardEvent): void {
  if (!state.currentTrack || event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(TYPING)) return;
  if (event.code === "Space") {
    if (target?.closest(PRESSABLE)) return;
    event.preventDefault();
    togglePlay();
  } else if (event.shiftKey && event.code === "ArrowRight") {
    event.preventDefault();
    debouncedNext();
  } else if (event.shiftKey && event.code === "ArrowLeft") {
    event.preventDefault();
    debouncedPrev();
  }
}

/** A browser may pause audio in a frozen tab although it should play */
function onVisibilityChange(): void {
  if (document.visibilityState !== "visible" || !audio) return;
  if (state.isPlaying && audio.paused && audio.getAttribute("src")) {
    void playSafely(audio);
  }
}

function addGlobalListeners(): void {
  if (hasGlobalListeners) return;
  hasGlobalListeners = true;
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibilityChange);
  registerMediaSessionHandlers();
}

// ── Station now-playing poll ────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | undefined;
let pollRun = 0;

function stopNowPlayingPoll(): void {
  pollRun++;
  clearInterval(pollTimer);
  pollTimer = undefined;
  update({ streamNowPlaying: "", streamArtwork: "" });
}

function startNowPlayingPoll(url: string): void {
  stopNowPlayingPoll();
  const run = pollRun;
  const poll = async () => {
    try {
      const reply = await fetchNowPlaying(url);
      if (run !== pollRun) return;
      const title = reply.title ?? "";
      const cover = reply.artwork ?? "";
      const isNew =
        (title && title !== state.streamNowPlaying) ||
        (cover && cover !== state.streamArtwork);
      if (!isNew) return;
      update({
        streamNowPlaying: title || state.streamNowPlaying,
        streamArtwork: cover || state.streamArtwork,
      });
      updateStreamMediaSession(state.streamNowPlaying, state.streamArtwork);
    } catch {
      // no metadata this time
    }
  };
  void poll();
  pollTimer = setInterval(() => void poll(), NOW_PLAYING_POLL_MS);
}

// ── Public actions ──────────────────────────────────────────────────────

export async function playTrack(
  track: Track,
  newQueue?: Track[],
  startIndex = 0,
): Promise<void> {
  const started = ++session;
  cancelCrossfade();
  cancelRecovery();
  destroyHls();
  hasPrefetchedNearEnd = false;
  shuffleNext = -1;
  if (recovery.trackId !== track.id) recovery = NO_RECOVERY;
  transcodeTriedFor = null;

  update({
    ...(newQueue ? { queue: newQueue, queueIndex: startIndex } : {}),
    currentTrack: track,
    progress: 0,
    currentTime: 0,
    duration: 0,
    isBuffering: false,
  });
  if (newQueue) failedInARow = 0;

  if (track.isStream && track.originalUrl) {
    startNowPlayingPoll(track.originalUrl);
  } else {
    stopNowPlayingPoll();
  }
  // The crossfade setting and "keep original format"
  void settingsStores.lt.ensureLoaded();

  const element = ensureAudio();
  element.volume = state.volume;
  update({ isPlaying: true });
  startTicks();
  updateMediaSession(track);

  if (await playThroughMse(track, element, Boolean(newQueue), started)) return;
  if (started !== session) return;

  if (isHlsUrl(track.streamUrl)) {
    await attachHls(element, track.streamUrl, started);
    return;
  }
  element.src = track.streamUrl;
  void playSafely(element);
  prefetchNext();
}

/** Plays the queue's entry at `index` */
export function playQueueIndex(index: number): void {
  const track = queued(index);
  if (!track) return;
  update({ queueIndex: index });
  void playTrack(track);
}

export function play(): void {
  const element = audio;
  const track = state.currentTrack;
  if (!element || !track) return;
  if (!element.getAttribute("src") && !hls) {
    void playTrack(track);
    return;
  }
  // At the end of the buffer there is nothing left to play: start over
  const entry = mse?.currentEntry();
  if (entry && element.currentTime >= entry.startTime + entry.duration - 0.1) {
    element.currentTime = entry.startTime;
  }
  update({ isPlaying: true });
  startTicks();
  // Suspended while in the background: load again first
  if (element.readyState === 0 || element.networkState === 3) {
    if (!mse && !hls) element.load();
  }
  void playSafely(element);
}

export function pause(): void {
  if (!audio) return;
  cancelCrossfade();
  cancelRecovery();
  audio.pause();
  update({ isPlaying: false });
  stopTicks();
}

export function togglePlay(): void {
  if (!audio) return;
  // While a stream is being reopened the element is paused, not the player
  if (audio.paused && !(state.isPlaying && recoveryTimer !== undefined)) {
    play();
  } else {
    pause();
  }
}

export function stop(): void {
  session++;
  cancelCrossfade();
  cancelRecovery();
  clearPrefetch();
  destroyHls();
  stopNowPlayingPoll();
  stopTicks();
  resetMse();
  shuffleNext = -1;
  recovery = NO_RECOVERY;
  failedInARow = 0;
  update({
    currentTrack: null,
    isPlaying: false,
    isBuffering: false,
    isQueueShown: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
  });
  if (audio) {
    audio.pause();
    unload(audio);
  }
  if (hasMediaSession()) navigator.mediaSession.metadata = null;
  setPlaybackState("none");
}

export async function next(): Promise<void> {
  if (state.queue.length === 0) return;
  const index = consumeNext();
  const track = queued(index);
  if (!track) {
    pause();
    return;
  }
  update({ queueIndex: index });

  // Seek into the buffer rather than change the source: a locked screen
  // keeps a tab alive only while its audio goes on
  const streamer = mse;
  if (streamer && audio && track.transcodeUrl) {
    const started = ++session;
    cancelCrossfade();
    try {
      await mseSwitchTo(streamer, track, audio, started);
      return;
    } catch (caught) {
      if (started !== session) return;
      console.warn("[player] MSE next failed, falling back:", caught);
      resetMse();
    }
  }
  await playTrack(track);
}

export function prev(): void {
  const element = audio;
  if (!element) return;
  cancelCrossfade();
  const { start } = segment();
  const action = prevAction(element.currentTime - start, state.queueIndex);
  if (action.type === "restart") {
    element.currentTime = start;
    return;
  }
  const track = queued(action.index);
  if (!track) return;
  update({ queueIndex: action.index });
  if (mse?.entryById(track.id)) {
    const started = ++session;
    shuffleNext = -1;
    void mseSwitchTo(mse, track, element, started);
    return;
  }
  resetMse();
  void playTrack(track);
}

/** To `fraction` (0 to 1) of the current track */
export function seek(fraction: number): void {
  if (!audio) return;
  const { start, end } = segment();
  if (!Number.isFinite(end)) return;
  cancelCrossfade();
  const share = Math.max(0, Math.min(1, fraction));
  audio.currentTime = start + share * (end - start);
  update({ currentTime: audio.currentTime - start, progress: share });
  updatePositionState();
}

export function setVolume(value: number): void {
  const volume = Math.max(0, Math.min(1, value));
  update({ volume });
  writeDevice("playerVolume", volume);
  if (!isCrossfading && audio) audio.volume = volume;
}

export function toggleShuffle(): void {
  shuffleNext = -1;
  update({ isShuffle: !state.isShuffle });
  writeDevice("playerShuffle", state.isShuffle);
}

export function cycleRepeat(): void {
  const repeat = nextRepeatMode(state.repeat);
  update({ repeat });
  writeDevice("playerRepeat", repeat);
}

export function setQueueShown(isQueueShown: boolean): void {
  update({ isQueueShown });
}

export function addToQueue(track: Track): void {
  shuffleNext = -1;
  update({ queue: appended(state.queue, track) });
}

export function playNext(track: Track): void {
  shuffleNext = -1;
  update({ queue: insertNext(state.queue, state.queueIndex, track) });
}

export function removeFromQueue(at: number): void {
  shuffleNext = -1;
  const result = removed(state.queue, state.queueIndex, at);
  update({ queue: result.queue, queueIndex: result.index });
  if (result.effect === "stop") stop();
  if (result.effect === "play") playQueueIndex(result.index);
}

export function moveInQueue(from: number, to: number): void {
  shuffleNext = -1;
  const result = moved(state.queue, state.queueIndex, from, to);
  update({ queue: result.queue, queueIndex: result.index });
}

export function clearQueue(): void {
  stop();
  shuffleNext = -1;
  update({ queue: [], queueIndex: -1 });
}
