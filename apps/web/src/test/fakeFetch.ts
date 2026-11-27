import { vi } from "vitest";

export interface FakeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
}

type Handler = (call: FakeCall) => FakeResponse;

/**
 * A `fetch` that answers from a handler and records every call. Bodies are
 * JSON; the handler sees parsed JSON bodies.
 */
export function fakeFetch(handler: Handler) {
  const calls: FakeCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>),
    );
    const call: FakeCall = {
      url: input instanceof Request ? input.url : input.toString(),
      method: init.method ?? "GET",
      headers,
      body:
        typeof init.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : init.body,
    };
    calls.push(call);
    const { status = 200, body } = handler(call);
    await Promise.resolve();
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}
