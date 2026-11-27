import { describe, expect, it } from "vitest";

import {
  bareMimeType,
  clipExtension,
  clock,
  defaultSetUuid,
  formatSizeMb,
  isOverClipLimit,
  MAX_CLIP_BYTES,
  pickRecorderMime,
} from "./setVideo";

describe("clock", () => {
  it("formats m:ss", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(5)).toBe("0:05");
    expect(clock(65)).toBe("1:05");
    expect(clock(60)).toBe("1:00");
    expect(clock(12.7)).toBe("0:12");
  });

  it("treats junk as zero", () => {
    expect(clock(-3)).toBe("0:00");
    expect(clock(Number.NaN)).toBe("0:00");
  });
});

describe("pickRecorderMime", () => {
  it("prefers mp4, then webm vp9, then webm", () => {
    expect(pickRecorderMime(() => true)).toBe("video/mp4");
    expect(pickRecorderMime((t) => t.startsWith("video/webm"))).toBe(
      "video/webm;codecs=vp9",
    );
    expect(pickRecorderMime((t) => t === "video/webm")).toBe("video/webm");
  });

  it("leaves the choice to the recorder when nothing fits", () => {
    expect(pickRecorderMime(() => false)).toBe("");
    expect(pickRecorderMime(undefined)).toBe("");
  });
});

describe("bareMimeType", () => {
  it("drops the parameters busboy cannot parse", () => {
    expect(bareMimeType("video/mp4;codecs=vp9,opus")).toBe("video/mp4");
    expect(bareMimeType("video/webm; codecs=vp9")).toBe("video/webm");
    expect(bareMimeType("")).toBe("video/mp4");
    expect(bareMimeType(null)).toBe("video/mp4");
  });
});

describe("clipExtension", () => {
  it("is webm for webm and mp4 otherwise", () => {
    expect(clipExtension("video/webm;codecs=vp9")).toBe("webm");
    expect(clipExtension("video/mp4")).toBe("mp4");
    expect(clipExtension("")).toBe("mp4");
  });
});

describe("isOverClipLimit", () => {
  it("allows exactly 200 MB", () => {
    expect(isOverClipLimit(MAX_CLIP_BYTES)).toBe(false);
    expect(isOverClipLimit(MAX_CLIP_BYTES + 1)).toBe(true);
  });
});

describe("formatSizeMb", () => {
  it("has one decimal in the locale", () => {
    expect(formatSizeMb(12.34 * 1024 * 1024, "en")).toBe("12.3");
    expect(formatSizeMb(12.34 * 1024 * 1024, "de")).toBe("12,3");
    expect(formatSizeMb(1024 * 1024, "en")).toBe("1.0");
  });
});

describe("defaultSetUuid", () => {
  it("picks the first set not done", () => {
    expect(
      defaultSetUuid([
        { uuid: "a", completed: true },
        { uuid: "b", completed: false },
        { uuid: "c" },
      ]),
    ).toBe("b");
  });

  it("picks the last when all are done", () => {
    expect(
      defaultSetUuid([
        { uuid: "a", completed: true },
        { uuid: "b", completed: 1 },
      ]),
    ).toBe("b");
  });

  it("is null without sets", () => {
    expect(defaultSetUuid([])).toBeNull();
    expect(defaultSetUuid(undefined)).toBeNull();
  });
});
