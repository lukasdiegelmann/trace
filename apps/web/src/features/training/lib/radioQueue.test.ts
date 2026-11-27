import { describe, expect, it } from "vitest";

import {
  addToQueue,
  cycleRepeat,
  fisherYatesShuffle,
  insertNext,
  moveInQueue,
  peekNextIndex,
  pickRandomNext,
  prevAction,
  QUEUE_MAX,
  removeFromQueue,
  type NextUpState,
} from "./radioQueue";

const state: NextUpState = {
  length: 3,
  index: 0,
  isShuffle: false,
  repeat: "off",
  shuffleNext: -1,
};

describe("peekNextIndex", () => {
  it("goes on, wraps with repeat all and ends without", () => {
    expect(peekNextIndex(state).index).toBe(1);
    expect(peekNextIndex({ ...state, index: 2 }).index).toBe(-1);
    expect(peekNextIndex({ ...state, index: 2, repeat: "all" }).index).toBe(0);
    expect(peekNextIndex({ ...state, index: 2, repeat: "one" }).index).toBe(-1);
    expect(peekNextIndex({ ...state, length: 0 }).index).toBe(-1);
  });

  it("keeps the committed shuffle pick", () => {
    const first = peekNextIndex({ ...state, isShuffle: true }, () => 0.9);
    expect(first).toEqual({ index: 2, shuffleNext: 2 });
    expect(
      peekNextIndex({ ...state, isShuffle: true, shuffleNext: 2 }, () => 0),
    ).toEqual(first);
    // A commit past the end of a shortened queue is dropped
    expect(
      peekNextIndex({ ...state, isShuffle: true, shuffleNext: 7 }, () => 0)
        .index,
    ).toBe(1);
  });

  it("never picks the current track at random", () => {
    for (let current = 0; current < 4; current++) {
      for (let i = 0; i < 20; i++) {
        const pick = pickRandomNext(4, current, () => i / 20);
        expect(pick).not.toBe(current);
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(4);
      }
    }
    expect(pickRandomNext(1, 0)).toBe(0);
    expect(pickRandomNext(0, -1)).toBe(-1);
  });
});

describe("prevAction", () => {
  it("restarts after 3 s and on the first track, else goes back", () => {
    expect(prevAction(3.1, 2)).toEqual({ type: "restart" });
    expect(prevAction(1, 0)).toEqual({ type: "restart" });
    expect(prevAction(1, -1)).toEqual({ type: "restart" });
    expect(prevAction(3, 2)).toEqual({ type: "go", index: 1 });
  });
});

describe("queue editing", () => {
  const queue = ["a", "b", "c", "d"];

  it("appends and inserts after the current track", () => {
    expect(addToQueue(["a"], "b")).toEqual(["a", "b"]);
    expect(insertNext(queue, 1, "x")).toEqual(["a", "b", "x", "c", "d"]);
  });

  it("drops what goes beyond the cap", () => {
    const full = Array.from({ length: QUEUE_MAX }, (_, i) => String(i));
    expect(addToQueue(full, "x")).toEqual(full);
    expect(insertNext(full, 0, "x")).toEqual(full);
  });

  it("shifts the index when an entry goes", () => {
    expect(removeFromQueue(queue, 2, 0)).toEqual({
      queue: ["b", "c", "d"],
      index: 1,
      effect: "none",
    });
    expect(removeFromQueue(queue, 1, 3)).toMatchObject({
      index: 1,
      effect: "none",
    });
    expect(removeFromQueue(queue, 1, 1)).toMatchObject({
      index: 1,
      effect: "play",
    });
    expect(removeFromQueue(queue, 3, 3)).toMatchObject({
      index: 2,
      effect: "play",
    });
    expect(removeFromQueue(["a"], 0, 0)).toEqual({
      queue: [],
      index: -1,
      effect: "stop",
    });
    expect(removeFromQueue(queue, 1, 9)).toMatchObject({ effect: "none" });
  });

  it("keeps the current track current when entries move", () => {
    expect(moveInQueue(queue, 1, 1, 3)).toEqual({
      queue: ["a", "c", "d", "b"],
      index: 3,
    });
    expect(moveInQueue(queue, 2, 0, 3).index).toBe(1);
    expect(moveInQueue(queue, 1, 3, 0).index).toBe(2);
    expect(moveInQueue(queue, 1, 2, 3).index).toBe(1);
  });

  it("cycles repeat off, all, one", () => {
    expect(cycleRepeat("off")).toBe("all");
    expect(cycleRepeat("all")).toBe("one");
    expect(cycleRepeat("one")).toBe("off");
  });

  it("shuffles into a copy with the same entries", () => {
    const shuffled = fisherYatesShuffle(queue, () => 0);
    expect(shuffled).toEqual(["b", "c", "d", "a"]);
    expect(queue).toEqual(["a", "b", "c", "d"]);
  });
});
