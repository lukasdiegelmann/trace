import { describe, expect, it, vi } from "vitest";

import { formatDateTime, relativeTime } from "./format";
import {
  fetchVersionInfo,
  isBundleOutdated,
  parseVersionInfo,
  shortCommit,
} from "./versionInfo";

const commit = "cfffa47b0fc4051360bde5eb6d6b3d26d8c04946";
const full = {
  commit,
  commitUrl: `https://git.example.com/me/trace/commit/${commit}`,
  ref: "main",
  builtAt: "2026-11-27T13:49:00.000Z",
  deployedAt: "2026-11-27T13:50:00Z",
  source: "ci",
  runUrl: "https://ci.example.com/runs/1",
  repoUrl: "https://git.example.com/me/trace",
};

function answering(body: string, status = 200) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(body, { status })),
  );
}

describe("parseVersionInfo", () => {
  it("reads every field", () => {
    expect(parseVersionInfo(full)).toEqual(full);
  });

  it("leaves out what is off, and links that are not web addresses", () => {
    expect(
      parseVersionInfo({
        commit,
        commitUrl: "javascript:alert(1)",
        builtAt: "yesterday",
        deployedAt: 5,
        source: "ftp",
        ref: "",
      }),
    ).toEqual({ commit });
  });

  it.each([null, "x", 1, {}, { commit: "" }, { commit: "not-a-sha" }])(
    "is nothing without a commit: %j",
    (value) => {
      expect(parseVersionInfo(value)).toBeNull();
    },
  );
});

describe("fetchVersionInfo", () => {
  it("asks past the HTTP cache", async () => {
    const fetch = answering(JSON.stringify(full));
    await expect(fetchVersionInfo(fetch)).resolves.toEqual(full);
    expect(fetch).toHaveBeenCalledWith("/version.json", { cache: "no-store" });
  });

  it("is nothing for a missing file", async () => {
    await expect(
      fetchVersionInfo(answering("Not Found", 404)),
    ).resolves.toBeNull();
  });

  it("is nothing when the app page answers instead", async () => {
    await expect(
      fetchVersionInfo(answering("<!doctype html>")),
    ).resolves.toBeNull();
  });

  it("is nothing without a connection", async () => {
    await expect(
      fetchVersionInfo(() => Promise.reject(new TypeError("offline"))),
    ).resolves.toBeNull();
  });
});

describe("isBundleOutdated", () => {
  const info = { commit };

  it("is true for a bundle of another commit", () => {
    expect(isBundleOutdated("d44cde595c5a281238976a7b", info)).toBe(true);
  });

  it("is false for the deployed commit", () => {
    expect(isBundleOutdated(commit.toUpperCase(), info)).toBe(false);
  });

  it("is false while either side is unknown", () => {
    expect(isBundleOutdated("", info)).toBe(false);
    expect(isBundleOutdated(commit, null)).toBe(false);
  });
});

describe("formatting", () => {
  it("shortens the commit", () => {
    expect(shortCommit(commit)).toBe("cfffa47");
  });

  it("says when, absolute and relative", () => {
    const now = Date.parse("2026-11-27T15:50:00Z");
    expect(relativeTime(full.deployedAt, "de", now)).toBe("vor 2 Stunden");
    expect(relativeTime(full.deployedAt, "en", now)).toBe("2 hours ago");
    expect(formatDateTime(full.deployedAt, "de")).toContain("2026");
  });
});
