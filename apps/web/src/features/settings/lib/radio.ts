/** The connection test of LiftTrace's radio providers (src/lib/radio-provider.js) */
import { api, ApiError } from "@/api";
import { md5 } from "@/lib/md5";

export const RADIO_PROVIDERS = [
  "emby",
  "jellyfin",
  "plex",
  "subsonic",
] as const;
export type RadioProvider = (typeof RADIO_PROVIDERS)[number];

export const RADIO_PLACEHOLDERS: Record<RadioProvider, string> = {
  emby: "https://emby.example.com",
  jellyfin: "https://jellyfin.example.com",
  plex: "https://plex.example.com:32400",
  subsonic: "https://navidrome.example.com",
};

interface SubsonicAnswer {
  "subsonic-response"?: { status?: string; error?: { message?: string } };
}

export function subsonicAuth(
  user: string,
  password: string,
  salt: string = Math.random().toString(36).slice(2, 10),
): Record<string, string> {
  return {
    u: user,
    t: md5(password + salt),
    s: salt,
    v: "1.16.1",
    c: "LiftTrace",
    f: "json",
  };
}

/**
 * Through LiftTrace's proxy, which reads the saved address and token, so
 * flush the settings first. Emby's endpoint is public: it shows the server
 * answers, not that the key is right (as in the old UI).
 */
export async function pingRadio(
  provider: RadioProvider,
  user: string,
  password: string,
): Promise<void> {
  // The proxy passes the music server's 401 on: the Trace session lives.
  const options = { shouldVerify401: true };
  if (provider === "subsonic") {
    const answer = await api.lt.get<SubsonicAnswer>("/subsonic/rest/ping", {
      ...options,
      query: subsonicAuth(user, password),
    });
    const root = answer["subsonic-response"];
    if (root?.status !== "ok") {
      throw new Error(root?.error?.message ?? "Subsonic error");
    }
    return;
  }
  if (provider === "plex") {
    await api.lt.get("/subsonic/provider/plex/identity", options);
    return;
  }
  if (provider === "emby") {
    await api.lt.get("/subsonic/provider/emby/System/Info/Public", options);
    return;
  }
  try {
    await api.lt.get("/subsonic/provider/jf/Users/Me", options);
  } catch (caught) {
    if (!(caught instanceof ApiError && caught.status === 404)) throw caught;
    await api.lt.get("/subsonic/provider/jf/System/Info", options);
  }
}
