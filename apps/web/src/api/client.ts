import { apiPath, BACKEND_NEEDS_CSRF, type BackendId } from "./backends";
import { ApiError, SessionExpiredError } from "./errors";

/** What every backend's `GET /api/auth/me` has in common */
export interface BackendUser {
  id: number;
  username?: string;
  display_name?: string | null;
  email?: string | null;
  is_admin?: number | boolean;
  [field: string]: unknown;
}

export interface MeResponse {
  user: BackendUser | null;
  /** nt and ct only; lt has no CSRF */
  csrf?: string | null;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  /** A plain object is sent as JSON; FormData, Blob and strings as they are */
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * For calls that answer 401 for another reason than the session, e.g.
   * NutriTrace when a wearable's grant is gone: ask `/auth/me` first, and
   * only a signed-out answer counts as an expired session. Otherwise the
   * 401 is an ordinary `ApiError`.
   */
  shouldVerify401?: boolean;
}

export interface ApiClientOptions {
  fetch?: typeof fetch;
  /** Called on a 401: the backend needs a sign-in again */
  onSessionExpired?: (backend: BackendId) => void;
}

export interface ApiClient {
  readonly backend: BackendId;
  request: <T>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions,
  ) => Promise<T>;
  get: <T>(path: string, options?: RequestOptions) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ) => Promise<T>;
  put: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ) => Promise<T>;
  patch: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ) => Promise<T>;
  delete: <T>(path: string, options?: RequestOptions) => Promise<T>;
  /** `GET /api/auth/me`; also takes the CSRF token from it */
  me: () => Promise<MeResponse>;
  /** Sets the CSRF token, e.g. from a `me()` done elsewhere */
  setCsrfToken: (token: string | null) => void;
}

const SAFE_METHODS = new Set<HttpMethod>(["GET"]);

function isJsonBody(body: unknown): boolean {
  return (
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof URLSearchParams) &&
    typeof body !== "string"
  );
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text === "") return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

/** `403 {"error":"Invalid CSRF token"}` (nutritrace/server/middleware/csrf.js:40) */
function isCsrfRejection(response: Response, body: unknown): boolean {
  return (
    response.status === 403 &&
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string" &&
    /csrf/i.test(body.error)
  );
}

function withQuery(url: string, query: RequestOptions["query"]): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

/**
 * A client for one backend, after deploy/SSO.md §3: relative URLs, the
 * cookie session (`credentials: "same-origin"`), `X-CSRF-Token` on unsafe
 * methods for nt and ct, fetched lazily and once more after a 401 or 403.
 */
export function createApiClient(
  backend: BackendId,
  options: ApiClientOptions = {},
): ApiClient {
  const doFetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const isCsrfChecked = BACKEND_NEEDS_CSRF[backend];
  let csrfToken: string | null = null;
  let pendingCsrf: Promise<string | null> | null = null;

  async function me(): Promise<MeResponse> {
    const response = await doFetch(apiPath(backend, "/auth/me"), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const body = await parseBody(response);
    if (!response.ok) throw new ApiError(backend, response.status, body);
    // Anything but {"user": ...} is not the backend (e.g. an HTML fallback
    // page while it is down): treat it as unreachable, not as signed out.
    if (typeof body !== "object" || body === null || !("user" in body)) {
      throw new ApiError(backend, response.status, body);
    }
    const result = body as MeResponse;
    if (isCsrfChecked) csrfToken = result.csrf ?? null;
    return result;
  }

  /** One `me()` at a time, however many requests wait for a token */
  function refreshCsrf(): Promise<string | null> {
    pendingCsrf ??= me()
      .then(() => csrfToken)
      .finally(() => {
        pendingCsrf = null;
      });
    return pendingCsrf;
  }

  /** Whether the session lives on; an unreachable backend can't say it ended */
  async function isStillSignedIn(): Promise<boolean> {
    try {
      return (await me()).user !== null;
    } catch {
      return true;
    }
  }

  async function send(
    method: HttpMethod,
    path: string,
    requestOptions: RequestOptions,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...requestOptions.headers,
    };
    const { body } = requestOptions;
    let payload: BodyInit | undefined;
    if (isJsonBody(body)) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    } else if (body !== undefined && body !== null) {
      payload = body as BodyInit;
    }
    if (isCsrfChecked && !SAFE_METHODS.has(method) && csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    return doFetch(withQuery(apiPath(backend, path), requestOptions.query), {
      method,
      headers,
      body: payload,
      credentials: "same-origin",
      signal: requestOptions.signal,
    });
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const isUnsafe = !SAFE_METHODS.has(method);
    if (isCsrfChecked && isUnsafe && !csrfToken) await refreshCsrf();

    let response = await send(method, path, requestOptions);
    let body = await parseBody(response);

    // The token may be stale (a new session since we fetched it): fetch
    // it again and retry once. Other 403s (no permission) are passed on.
    if (isCsrfChecked && isUnsafe && isCsrfRejection(response, body)) {
      await refreshCsrf();
      response = await send(method, path, requestOptions);
      body = await parseBody(response);
    }

    if (response.status === 401) {
      if (requestOptions.shouldVerify401 && (await isStillSignedIn())) {
        throw new ApiError(backend, response.status, body);
      }
      csrfToken = null;
      options.onSessionExpired?.(backend);
      throw new SessionExpiredError(backend, body);
    }
    if (!response.ok) throw new ApiError(backend, response.status, body);
    return body as T;
  }

  return {
    backend,
    request,
    get: (path, requestOptions) => request("GET", path, requestOptions),
    post: (path, body, requestOptions) =>
      request("POST", path, { ...requestOptions, body }),
    put: (path, body, requestOptions) =>
      request("PUT", path, { ...requestOptions, body }),
    patch: (path, body, requestOptions) =>
      request("PATCH", path, { ...requestOptions, body }),
    delete: (path, requestOptions) => request("DELETE", path, requestOptions),
    me,
    setCsrfToken: (token) => {
      csrfToken = isCsrfChecked ? token : null;
    },
  };
}
