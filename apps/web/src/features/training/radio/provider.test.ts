import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api";
import { fakeFetch, type FakeResponse } from "@/test/fakeFetch";

import { createRadioProvider, ProviderError } from "./provider";

const config = { provider: "jellyfin", user: "joe", password: "secret" };

function serve(handler: (url: string) => FakeResponse) {
  const fake = fakeFetch((call) => handler(call.url));
  vi.stubGlobal("fetch", fake.fetch);
  return fake.calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Jellyfin ping", () => {
  it("signs in through Users/Me, never the public info page", async () => {
    const calls = serve(() => ({ body: {} }));
    await createRadioProvider(config, "?").ping();
    expect(calls.map((call) => call.url)).toEqual([
      "/lt/api/subsonic/provider/jf/Users/Me",
    ]);
  });

  it("falls back to System/Info on a 404", async () => {
    const calls = serve((url) =>
      url.endsWith("Users/Me") ? { status: 404, body: {} } : { body: {} },
    );
    await createRadioProvider(config, "?").ping();
    expect(calls.at(-1)?.url).toBe("/lt/api/subsonic/provider/jf/System/Info");
  });

  it("passes the proxy's refusal on without ending the session", async () => {
    serve(() => ({
      status: 401,
      body: { error: "Jellyfin refused the sign-in" },
    }));
    const get = vi.spyOn(api.lt, "get");
    await expect(createRadioProvider(config, "?").ping()).rejects.toThrow(
      "Jellyfin refused the sign-in",
    );
    expect(get).not.toHaveBeenCalled();
  });

  it("names the status when there is no message", async () => {
    serve(() => ({ status: 502 }));
    await expect(createRadioProvider(config, "?").ping()).rejects.toEqual(
      new ProviderError(502),
    );
  });
});

describe("media URLs", () => {
  const item = { id: "s1", title: "S", coverArt: "al", container: "flac" };

  it("lie below /lt, with a transcode for Jellyfin", () => {
    const track = createRadioProvider(config, "Unknown").songToTrack(item);
    expect(track).toMatchObject({
      artist: "Unknown",
      container: "flac",
      streamUrl: "/lt/api/subsonic/provider/jf/Audio/s1/stream?static=true",
      coverUrl:
        "/lt/api/subsonic/provider/jf/Items/al/Images/Primary?maxWidth=300&maxHeight=300",
    });
    expect(track.transcodeUrl).toContain(
      "/lt/api/subsonic/provider/jf/Audio/s1/universal?Container=",
    );
  });

  it("use /emby for Emby's media but /jf for its library", async () => {
    const emby = createRadioProvider({ ...config, provider: "emby" }, "?");
    expect(emby.songToTrack(item).streamUrl).toContain("/provider/emby/Audio/");
    const calls = serve(() => ({ body: { Items: [] } }));
    await emby.getPlaylists();
    await emby.ping();
    expect(calls[0].url).toContain("/provider/jf/Items?");
    expect(calls[1].url).toBe(
      "/lt/api/subsonic/provider/emby/System/Info/Public",
    );
  });

  it("sign Subsonic URLs and keep a cover's URL stable", () => {
    const subsonic = createRadioProvider(
      { ...config, provider: "subsonic" },
      "?",
    );
    const track = subsonic.songToTrack(item);
    expect(track.streamUrl).toMatch(
      /^\/lt\/api\/subsonic\/rest\/stream\?u=joe&t=[0-9a-f]{32}&s=\w{8}&/,
    );
    expect(track.transcodeUrl).toBeUndefined();
    expect(track.streamUrl).not.toContain("secret");
    expect(subsonic.coverArtUrl("al", 300)).toBe(track.coverUrl);
    expect(subsonic.hasStars).toBe(true);
  });

  it("throws Subsonic's own error message", async () => {
    serve(() => ({
      body: {
        "subsonic-response": {
          status: "failed",
          error: { message: "Wrong username or password" },
        },
      },
    }));
    await expect(
      createRadioProvider({ ...config, provider: "subsonic" }, "?").ping(),
    ).rejects.toThrow("Wrong username or password");
  });
});
