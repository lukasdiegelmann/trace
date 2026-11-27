import { describe, expect, it, vi } from "vitest";

import { fakeFetch, type FakeResponse } from "@/test/fakeFetch";

import {
  continueSignIn,
  endSessionUrl,
  loadSsoState,
  loginUrl,
  LOGOUT_URL_STORAGE_KEY,
  safeNextPath,
  signOut,
  SSO_STORAGE_KEY,
  startSignIn,
  type SsoDeps,
} from "./sso";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
}

function setup(
  handler: (url: string, method: string) => FakeResponse = () => ({
    body: { providers: [{ id: 1, display_name: "SSO" }] },
  }),
) {
  const storage = memoryStorage();
  const navigate = vi.fn<(url: string) => void>();
  const { fetch, calls } = fakeFetch((call) => handler(call.url, call.method));
  const deps: SsoDeps = {
    fetch,
    storage,
    navigate,
    origin: "https://trace.lukasdiegelmann.net",
  };
  return { deps, storage, navigate, calls };
}

const RETURN_NT = encodeURIComponent("/__trace/auth/callback/nt");

describe("loginUrl", () => {
  it("points at the backend's OIDC login with the /__trace return path", () => {
    expect(loginUrl("nt", 1)).toBe(
      `/nt/api/auth/oidc/login/1?return=${RETURN_NT}`,
    );
    expect(loginUrl("lt", "pid")).toBe(
      `/lt/api/auth/oidc/login/pid?return=${encodeURIComponent("/__trace/auth/callback/lt")}`,
    );
  });

  it("keeps the return path within the backends' 256 characters, without a query", () => {
    const url = new URL(loginUrl("ct", 1), "https://x");
    const returnPath = url.searchParams.get("return") ?? "";
    expect(returnPath.length).toBeLessThanOrEqual(256);
    expect(returnPath).not.toContain("?");
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/diary", "/diary"],
    ["/cooking?tab=pantry", "/cooking?tab=pantry"],
    ["https://evil.example/", "/"],
    ["//evil.example/", "/"],
    ["/auth/callback/nt", "/"],
    ["/__trace/x", "/"],
    ["/nt/", "/"],
    ["", "/"],
    [null, "/"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("startSignIn", () => {
  it("stores the todo list and navigates the window to the first backend", async () => {
    const { deps, storage, navigate, calls } = setup();

    await startSignIn(["nt", "ct", "lt"], "/training", deps);

    expect(calls[0]?.url).toBe("/nt/api/auth/oidc/providers");
    expect(navigate).toHaveBeenCalledWith(
      `/nt/api/auth/oidc/login/1?return=${RETURN_NT}`,
    );
    expect(loadSsoState(storage)).toEqual({
      current: "nt",
      todo: ["ct", "lt"],
      next: "/training",
    });
  });

  it("reads the provider ID instead of assuming one", async () => {
    const { deps, navigate } = setup(() => ({
      body: { providers: [{ id: 7 }] },
    }));

    await startSignIn(["ct"], "/", deps);

    expect(navigate.mock.calls[0]?.[0]).toMatch(
      /^\/ct\/api\/auth\/oidc\/login\/7\?/,
    );
  });

  it("fails without navigating when the backend has no provider", async () => {
    const { deps, navigate, storage } = setup(() => ({
      body: { providers: [] },
    }));

    await expect(startSignIn(["nt"], "/", deps)).rejects.toMatchObject({
      code: "noProvider",
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.map.has(SSO_STORAGE_KEY)).toBe(false);
  });

  it("does nothing when every backend is signed in", async () => {
    const { deps, navigate } = setup();
    await expect(startSignIn([], "/", deps)).resolves.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("continueSignIn", () => {
  it("goes on with the next backend after oidc=ok", async () => {
    const { deps, storage, navigate } = setup();
    await startSignIn(["nt", "ct", "lt"], "/cooking", deps);
    navigate.mockClear();

    const outcome = await continueSignIn("nt", "?oidc=ok", deps);

    expect(outcome).toEqual({
      kind: "redirect",
      url: `/ct/api/auth/oidc/login/1?return=${encodeURIComponent("/__trace/auth/callback/ct")}`,
    });
    expect(navigate).toHaveBeenCalledWith(
      outcome.kind === "redirect" ? outcome.url : "",
    );
    expect(loadSsoState(storage)).toEqual({
      current: "ct",
      todo: ["lt"],
      next: "/cooking",
    });
  });

  it("walks the whole chain and ends at next, clearing the state", async () => {
    const { deps, storage } = setup();
    await startSignIn(["nt", "ct", "lt"], "/cooking", deps);

    expect((await continueSignIn("nt", "?oidc=ok", deps)).kind).toBe(
      "redirect",
    );
    expect((await continueSignIn("ct", "?oidc=ok", deps)).kind).toBe(
      "redirect",
    );
    expect(await continueSignIn("lt", "?oidc=ok", deps)).toEqual({
      kind: "done",
      next: "/cooking",
    });
    expect(storage.map.has(SSO_STORAGE_KEY)).toBe(false);
  });

  it("stops the chain on oidc_error and hands over the decoded message", async () => {
    const { deps, storage, navigate } = setup();
    await startSignIn(["nt", "ct"], "/", deps);
    navigate.mockClear();

    // As the browser sees it after the proxy rewrite: the message URL-encoded once.
    const outcome = await continueSignIn(
      "nt",
      "?oidc_error=User%20is%20disabled",
      deps,
    );

    expect(outcome).toMatchObject({ kind: "error", backend: "nt" });
    expect(outcome.kind === "error" && outcome.error.message).toBe(
      "User is disabled",
    );
    expect(outcome.kind === "error" && outcome.error.code).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.map.has(SSO_STORAGE_KEY)).toBe(false);
  });

  it("treats a callback without a result as an error", async () => {
    const { deps } = setup();
    const outcome = await continueSignIn("ct", "", deps);
    expect(outcome).toMatchObject({
      kind: "error",
      error: { code: "missingResult" },
    });
  });

  it("ends a callback outside a chain (a reload) at the start", async () => {
    const { deps, navigate } = setup();
    expect(await continueSignIn("lt", "?oidc=ok", deps)).toEqual({
      kind: "done",
      next: "/",
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports when the next backend can't start its sign-in", async () => {
    let isCtDown = false;
    const { deps } = setup((url) =>
      isCtDown && url.startsWith("/ct/")
        ? { status: 502 }
        : { body: { providers: [{ id: 1 }] } },
    );
    await startSignIn(["nt", "ct"], "/", deps);
    isCtDown = true;

    const outcome = await continueSignIn("nt", "?oidc=ok", deps);

    expect(outcome).toMatchObject({
      kind: "error",
      backend: "ct",
      error: { code: "providersUnavailable" },
    });
  });

  it("ignores a corrupt state entry", async () => {
    const { deps, storage } = setup();
    storage.setItem(SSO_STORAGE_KEY, '{"current":"xx","todo":[],"next":"/"}');
    expect(loadSsoState(storage)).toBeNull();
    storage.setItem(SSO_STORAGE_KEY, "not json");
    expect(await continueSignIn("nt", "?oidc=ok", deps)).toEqual({
      kind: "done",
      next: "/",
    });
  });
});

describe("signOut", () => {
  const logoutUrl =
    "https://id.example.com/api/oidc/end-session?post_logout_redirect_uri=https%3A%2F%2Ftrace.lukasdiegelmann.net%2Fnt%2F&id_token_hint=abc";

  it("logs out of every backend, then ends the provider's session back to /", async () => {
    const { deps, navigate, calls } = setup((url) =>
      url.startsWith("/nt/")
        ? { body: { ok: true, logoutUrl } }
        : { body: { ok: true } },
    );

    await signOut(deps);

    expect(calls.map((call) => `${call.method} ${call.url}`).sort()).toEqual([
      "POST /ct/api/auth/oidc/logout",
      "POST /lt/api/auth/oidc/logout",
      "POST /nt/api/auth/oidc/logout",
    ]);
    const target = new URL(navigate.mock.calls[0]?.[0] ?? "");
    expect(target.origin + target.pathname).toBe(
      "https://id.example.com/api/oidc/end-session",
    );
    expect(target.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://trace.lukasdiegelmann.net/",
    );
    expect(target.searchParams.get("id_token_hint")).toBe("abc");
  });

  it("goes to / when no backend came from OIDC", async () => {
    const { deps, navigate } = setup(() => ({ body: { ok: true } }));
    expect(await signOut(deps)).toEqual({ kind: "redirect", url: "/" });
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("stays and names the backends whose logout failed", async () => {
    const { deps, navigate } = setup((url) =>
      url.startsWith("/nt/")
        ? { body: { ok: true, logoutUrl } }
        : url.startsWith("/ct/")
          ? { status: 500 }
          : { body: { ok: true } },
    );

    expect(await signOut(deps)).toEqual({ kind: "incomplete", failed: ["ct"] });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("counts a request that doesn't reach the backend as failed", async () => {
    const { deps, navigate } = setup(() => ({ body: { ok: true } }));
    const failing = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      (input instanceof Request ? input.url : input.toString()).startsWith(
        "/lt/",
      )
        ? Promise.reject(new TypeError("Failed to fetch"))
        : deps.fetch(input, init),
    );

    const outcome = await signOut({ ...deps, fetch: failing });

    expect(outcome).toEqual({ kind: "incomplete", failed: ["lt"] });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps the end-session URL for the retry and ends the session then", async () => {
    let isCtDown = true;
    let hasGivenLogoutUrl = false;
    const { deps, navigate, storage } = setup((url) => {
      if (url.startsWith("/ct/") && isCtDown) return { status: 500 };
      if (url.startsWith("/nt/") && !hasGivenLogoutUrl) {
        // The backend clears its id_token cookie: it hands this out once.
        hasGivenLogoutUrl = true;
        return { body: { ok: true, logoutUrl } };
      }
      return { body: { ok: true } };
    });

    expect((await signOut(deps)).kind).toBe("incomplete");
    isCtDown = false;
    const outcome = await signOut(deps);

    expect(outcome.kind).toBe("redirect");
    const target = new URL(navigate.mock.calls[0]?.[0] ?? "");
    expect(target.searchParams.get("id_token_hint")).toBe("abc");
    expect(storage.map.has(LOGOUT_URL_STORAGE_KEY)).toBe(false);
  });

  it("rewrites only post_logout_redirect_uri", () => {
    const url = new URL(
      endSessionUrl(logoutUrl, "https://trace.lukasdiegelmann.net"),
    );
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://trace.lukasdiegelmann.net/",
    );
    expect(url.searchParams.get("id_token_hint")).toBe("abc");
  });
});
