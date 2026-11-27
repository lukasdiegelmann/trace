import { describe, expect, it } from "vitest";

import { formatBytes, offMirrorState } from "./foodSources";
import { subsonicAuth } from "./radio";
import { previewSteps } from "./restTones";

describe("Subsonic's token", () => {
  it("is built from password and salt", () => {
    // The example of the Subsonic API documentation.
    expect(subsonicAuth("joe", "sesame", "c19b2d").t).toBe(
      "26719a1196d2a940705a59634eb18eab",
    );
  });
});

describe("rest tone preview", () => {
  it("plays two countdown beeps before the finale", () => {
    expect(previewSteps("classic").map((s) => s.delayMs)).toEqual([
      0, 200, 400, 600,
    ]);
    expect(previewSteps("minimal")).toHaveLength(1);
    expect(previewSteps("unknown")).toEqual(previewSteps("classic"));
  });
});

describe("local OFF mirror", () => {
  const day = 86_400_000;
  it("names the old banner states", () => {
    const base = { size_bytes: 10, mtime_ms: 0, refresh_interval: "daily" };
    expect(offMirrorState(base, day / 2)).toBe("ready");
    expect(offMirrorState(base, day * 2)).toBe("stale");
    expect(offMirrorState({ ...base, size_bytes: null }, 0)).toBe("notReady");
    expect(offMirrorState({ ...base, refresh: { last_error: "x" } }, 0)).toBe(
      "failedStale",
    );
    expect(
      offMirrorState({ ...base, refresh: { state: "downloading" } }, 0),
    ).toBe("downloading");
    expect(formatBytes(10)).toBe("1 KB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});
