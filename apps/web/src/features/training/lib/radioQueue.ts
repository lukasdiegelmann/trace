/**
 * The player's queue as pure functions, after
 * backends/lifttrace/src/stores/player.js.
 */

/** About 8 hours of playback; adds beyond it are dropped */
export const QUEUE_MAX = 500;

export type RepeatMode = "off" | "all" | "one";

const REPEAT_MODES: readonly RepeatMode[] = ["off", "all", "one"];

export function cycleRepeat(mode: RepeatMode): RepeatMode {
  return (
    REPEAT_MODES[(REPEAT_MODES.indexOf(mode) + 1) % REPEAT_MODES.length] ??
    "off"
  );
}

export function isRepeatMode(value: unknown): value is RepeatMode {
  return REPEAT_MODES.includes(value as RepeatMode);
}

/** A random index other than the current one; -1 for an empty queue */
export function pickRandomNext(
  length: number,
  current: number,
  random: () => number = Math.random,
): number {
  if (length === 0) return -1;
  if (length === 1) return 0;
  const hasCurrent = current >= 0 && current < length;
  const pick = Math.floor(random() * (hasCurrent ? length - 1 : length));
  return hasCurrent && pick >= current ? pick + 1 : pick;
}

export interface NextUpState {
  length: number;
  index: number;
  isShuffle: boolean;
  repeat: RepeatMode;
  /** The committed "next up" of shuffle mode, -1 when none */
  shuffleNext: number;
}

export interface NextUp {
  /** -1: there is no next track */
  index: number;
  /** What to commit, so prefetch and the advance agree on one track */
  shuffleNext: number;
}

/** The track after `from` (the current one), without consuming the commit */
export function peekNextIndex(
  state: NextUpState,
  random: () => number = Math.random,
): NextUp {
  const { length, index, isShuffle, repeat, shuffleNext } = state;
  if (length === 0) return { index: -1, shuffleNext: -1 };
  if (isShuffle) {
    const committed =
      shuffleNext >= 0 && shuffleNext < length
        ? shuffleNext
        : pickRandomNext(length, index, random);
    return { index: committed, shuffleNext: committed };
  }
  const next = index + 1;
  if (next >= length) {
    return { index: repeat === "all" ? 0 : -1, shuffleNext: -1 };
  }
  return { index: next, shuffleNext: -1 };
}

export type PrevAction = { type: "restart" } | { type: "go"; index: number };

/** After 3 s, or on the first track, "previous" restarts; it never wraps */
export function prevAction(elapsed: number, index: number): PrevAction {
  if (elapsed > 3 || index <= 0) return { type: "restart" };
  return { type: "go", index: index - 1 };
}

export function addToQueue<T>(queue: readonly T[], item: T): T[] {
  if (queue.length >= QUEUE_MAX) return [...queue];
  return [...queue, item];
}

export function insertNext<T>(
  queue: readonly T[],
  index: number,
  item: T,
): T[] {
  const copy = [...queue];
  if (copy.length >= QUEUE_MAX) return copy;
  copy.splice(index + 1, 0, item);
  return copy;
}

export interface Removal<T> {
  queue: T[];
  index: number;
  /** What the player has to do: nothing, stop, or play `queue[index]` */
  effect: "none" | "stop" | "play";
}

export function removeFromQueue<T>(
  queue: readonly T[],
  current: number,
  at: number,
): Removal<T> {
  if (at < 0 || at >= queue.length) {
    return { queue: [...queue], index: current, effect: "none" };
  }
  const rest = queue.filter((_, i) => i !== at);
  if (at < current) return { queue: rest, index: current - 1, effect: "none" };
  if (at > current) return { queue: rest, index: current, effect: "none" };
  if (rest.length === 0) return { queue: rest, index: -1, effect: "stop" };
  return {
    queue: rest,
    index: Math.min(current, rest.length - 1),
    effect: "play",
  };
}

export function moveInQueue<T>(
  queue: readonly T[],
  current: number,
  from: number,
  to: number,
): { queue: T[]; index: number } {
  const copy = [...queue];
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) {
    return { queue: copy, index: current };
  }
  copy.splice(to, 0, ...copy.splice(from, 1));
  let index = current;
  if (from === current) index = to;
  else if (from < current && to >= current) index = current - 1;
  else if (from > current && to <= current) index = current + 1;
  return { queue: copy, index };
}

/** An unbiased shuffled copy */
export function fisherYatesShuffle<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = copy[i];
    copy[i] = copy[j];
    copy[j] = a;
  }
  return copy;
}
