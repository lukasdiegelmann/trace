import { describe, expect, it, vi } from "vitest";

import { fakeFetch } from "@/test/fakeFetch";

import { apiPath } from "./backends";
import { createApiClient } from "./client";
import { ApiError, SessionExpiredError } from "./errors";

describe("apiPath", () => {
  it("keeps every call relative under the backend's prefix", () => {
    expect(apiPath("nt", "/foods")).toBe("/nt/api/foods");
    expect(() => apiPath("ct", "recipes")).toThrow();
  });
});

describe("createApiClient: CSRF", () => {
  it("fetches the token from /auth/me before the first unsafe call of nt", async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url === "/nt/api/auth/me"
        ? { body: { user: { id: 1 }, csrf: "token-1" } }
        : { body: { ok: true } },
    );
    const client = createApiClient("nt", { fetch });

    await client.post("/foods", { name: "Apple" });

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET /nt/api/auth/me",
      "POST /nt/api/foods",
    ]);
    expect(calls[1]?.headers["X-CSRF-Token"]).toBe("token-1");
    expect(calls[1]?.headers["Content-Type"]).toBe("application/json");
    expect(calls[1]?.body).toEqual({ name: "Apple" });
  });

  it("sends no token on GET and fetches none for it", async () => {
    const { fetch, calls } = fakeFetch(() => ({ body: [] }));
    const client = createApiClient("ct", { fetch });

    await client.get("/recipes", {
      query: { q: "soup", page: 2, empty: undefined },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/ct/api/recipes?q=soup&page=2");
    expect(calls[0]?.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("reuses the token for later calls", async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.endsWith("/auth/me")
        ? { body: { user: { id: 1 }, csrf: "t" } }
        : { body: {} },
    );
    const client = createApiClient("nt", { fetch });

    await client.post("/a");
    await client.put("/b", { x: 1 });
    await client.delete("/c");

    expect(calls.filter((call) => call.url.endsWith("/auth/me"))).toHaveLength(
      1,
    );
  });

  it("fetches the token once for parallel calls", async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.endsWith("/auth/me")
        ? { body: { user: { id: 1 }, csrf: "t" } }
        : { body: {} },
    );
    const client = createApiClient("nt", { fetch });

    await Promise.all([
      client.post("/a"),
      client.post("/b"),
      client.patch("/c"),
    ]);

    expect(calls.filter((call) => call.url.endsWith("/auth/me"))).toHaveLength(
      1,
    );
  });

  it("re-fetches the token after a CSRF 403 and retries once", async () => {
    let meCount = 0;
    const { fetch, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/auth/me")) {
        meCount += 1;
        return { body: { user: { id: 1 }, csrf: `token-${meCount}` } };
      }
      return call.headers["X-CSRF-Token"] === "token-2"
        ? { body: { ok: true } }
        : { status: 403, body: { error: "Invalid CSRF token" } };
    });
    const client = createApiClient("ct", { fetch });

    await expect(client.post("/pantry", { item: "salt" })).resolves.toEqual({
      ok: true,
    });

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET /ct/api/auth/me",
      "POST /ct/api/pantry",
      "GET /ct/api/auth/me",
      "POST /ct/api/pantry",
    ]);
  });

  it("passes a 403 that isn't about CSRF on without a retry", async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.endsWith("/auth/me")
        ? { body: { user: { id: 1 }, csrf: "t" } }
        : { status: 403, body: { error: "Admin only" } },
    );
    const client = createApiClient("nt", { fetch });

    const error = await client
      .post("/admin/users")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).message).toBe("Admin only");
    expect(calls).toHaveLength(2);
  });

  it("gives up after the retry is rejected as well", async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.endsWith("/auth/me")
        ? { body: { user: { id: 1 }, csrf: "t" } }
        : { status: 403, body: { error: "Invalid CSRF token" } },
    );
    const client = createApiClient("nt", { fetch });

    await expect(client.post("/foods")).rejects.toBeInstanceOf(ApiError);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);
  });

  it("never sends or fetches a token for lt", async () => {
    const { fetch, calls } = fakeFetch(() => ({ body: { id: 7 } }));
    const client = createApiClient("lt", { fetch });

    await client.post("/workouts", { name: "Push" });
    client.setCsrfToken("ignored");
    await client.post("/workouts", { name: "Pull" });

    expect(calls.map((call) => call.url)).toEqual([
      "/lt/api/workouts",
      "/lt/api/workouts",
    ]);
    expect(calls.every((call) => !("X-CSRF-Token" in call.headers))).toBe(true);
  });

  it("uses a token set from outside without asking /me", async () => {
    const { fetch, calls } = fakeFetch(() => ({ body: {} }));
    const client = createApiClient("nt", { fetch });

    client.setCsrfToken("from-auth");
    await client.post("/diary");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers["X-CSRF-Token"]).toBe("from-auth");
  });
});

describe("createApiClient: sessions", () => {
  it("reports a 401 as an expired session and forgets the token", async () => {
    const onSessionExpired = vi.fn();
    let isSignedIn = true;
    const { fetch, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/auth/me"))
        return { body: { user: { id: 1 }, csrf: "t" } };
      return isSignedIn
        ? { body: {} }
        : { status: 401, body: { error: "Unauthorized" } };
    });
    const client = createApiClient("nt", { fetch, onSessionExpired });

    await client.post("/a");
    isSignedIn = false;
    await expect(client.post("/b")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(onSessionExpired).toHaveBeenCalledWith("nt");

    // The next unsafe call fetches a fresh token.
    isSignedIn = true;
    await client.post("/c");
    expect(calls.filter((call) => call.url.endsWith("/auth/me"))).toHaveLength(
      2,
    );
  });

  it("keeps the session on a verified 401 while /me knows the user", async () => {
    const onSessionExpired = vi.fn();
    const { fetch } = fakeFetch((call) =>
      call.url.endsWith("/auth/me")
        ? { body: { user: { id: 1 }, csrf: "t" } }
        : { status: 401, body: { error: "Fitbit token revoked" } },
    );
    const client = createApiClient("nt", { fetch, onSessionExpired });

    const failure = client.post("/sync", {}, { shouldVerify401: true });

    await expect(failure).rejects.toMatchObject({
      status: 401,
      message: "Fitbit token revoked",
    });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("expires the session on a verified 401 when /me has no user", async () => {
    const onSessionExpired = vi.fn();
    const { fetch } = fakeFetch((call) =>
      call.url.endsWith("/auth/me")
        ? { body: { user: null, csrf: null } }
        : { status: 401, body: { error: "Unauthorized" } },
    );
    const client = createApiClient("nt", { fetch, onSessionExpired });

    await expect(
      client.get("/sync", { shouldVerify401: true }),
    ).rejects.toBeInstanceOf(SessionExpiredError);
    expect(onSessionExpired).toHaveBeenCalledWith("nt");
  });

  it("calls with the cookie session, relative to the origin", async () => {
    const { fetch } = fakeFetch(() => ({ body: {} }));
    const client = createApiClient("lt", { fetch });

    await client.get("/exercises");

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.credentials).toBe("same-origin");
  });

  it("rejects a /me answer that isn't the backend's", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response("<!doctype html>", {
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const client = createApiClient("nt", { fetch });

    await expect(client.me()).rejects.toBeInstanceOf(ApiError);
  });

  it("returns undefined for an empty answer", async () => {
    const { fetch } = fakeFetch(() => ({ status: 204 }));
    const client = createApiClient("lt", { fetch });

    await expect(client.delete("/workouts/1")).resolves.toBeUndefined();
  });
});
