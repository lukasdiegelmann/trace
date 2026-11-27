/**
 * The SSO chain of deploy/SSO.md: one top-level redirect per backend through
 * the OIDC provider, the backends still to do kept in sessionStorage, and logout
 * incl. the provider's end-session. Pure logic with its effects (fetch, storage,
 * navigation) passed in, so it is testable without a browser.
 */
import { apiPath, BACKEND_IDS, type BackendId } from "@/api/backends";

export const SSO_STORAGE_KEY = "trace.sso";

/** The chain in progress */
export interface SsoState {
  /** The backend whose sign-in is under way */
  current: BackendId;
  /** The backends after it */
  todo: BackendId[];
  /** Where to go when all are done */
  next: string;
}

export interface SsoDeps {
  fetch: typeof fetch;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  /** A full page navigation (`window.location.assign`) */
  navigate: (url: string) => void;
  /** `https://trace.lukasdiegelmann.net` */
  origin: string;
}

export function browserSsoDeps(): SsoDeps {
  return {
    fetch: (...args) => globalThis.fetch(...args),
    storage: window.sessionStorage,
    navigate: (url) => {
      window.location.assign(url);
    },
    origin: window.location.origin,
  };
}

/** The path the backend redirects to after its callback; the reverse proxy strips `/<p>/#/__trace` */
export function callbackReturnPath(backend: BackendId): string {
  return `/__trace/auth/callback/${backend}`;
}

export function loginUrl(
  backend: BackendId,
  providerId: string | number,
): string {
  return `${apiPath(backend, `/auth/oidc/login/${encodeURIComponent(String(providerId))}`)}?return=${encodeURIComponent(callbackReturnPath(backend))}`;
}

/** Keeps `next` an in-app path: no other origin, no callback loop */
export function safeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    next.startsWith("/auth/") ||
    next.startsWith("/__trace") ||
    /^\/(nt|ct|lt)(\/|$)/.test(next)
  ) {
    return "/";
  }
  return next;
}

export function loadSsoState(storage: SsoDeps["storage"]): SsoState | null {
  const raw = storage.getItem(SSO_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SsoState>;
    const isValid =
      typeof value.current === "string" &&
      (BACKEND_IDS as readonly string[]).includes(value.current) &&
      Array.isArray(value.todo) &&
      value.todo.every((b) => (BACKEND_IDS as readonly string[]).includes(b)) &&
      typeof value.next === "string";
    return isValid ? (value as SsoState) : null;
  } catch {
    return null;
  }
}

function saveSsoState(storage: SsoDeps["storage"], state: SsoState): void {
  storage.setItem(SSO_STORAGE_KEY, JSON.stringify(state));
}

export function clearSsoState(storage: SsoDeps["storage"]): void {
  storage.removeItem(SSO_STORAGE_KEY);
}

interface ProvidersResponse {
  providers?: { id: string | number }[];
}

export class SsoError extends Error {
  /** An i18n key under `auth.errors`, or null when `message` is the backend's own */
  readonly code: "noProvider" | "providersUnavailable" | "missingResult" | null;

  constructor(code: SsoError["code"], message: string) {
    super(message);
    this.name = "SsoError";
    this.code = code;
  }
}

/** The OIDC provider's ID from `GET /<p>/api/auth/oidc/providers`; read, never hardcoded */
export async function fetchProviderId(
  backend: BackendId,
  deps: Pick<SsoDeps, "fetch">,
): Promise<string | number> {
  const response = await deps.fetch(apiPath(backend, "/auth/oidc/providers"), {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new SsoError(
      "providersUnavailable",
      `${backend}: providers answered ${response.status}`,
    );
  }
  const body = (await response.json()) as ProvidersResponse;
  const id = body.providers?.[0]?.id;
  if (id === undefined) {
    throw new SsoError("noProvider", `${backend}: no OIDC provider`);
  }
  return id;
}

async function redirectToLogin(
  state: SsoState,
  deps: SsoDeps,
): Promise<string> {
  const providerId = await fetchProviderId(state.current, deps);
  saveSsoState(deps.storage, state);
  const url = loginUrl(state.current, providerId);
  deps.navigate(url);
  return url;
}

/**
 * Starts the chain for the backends that need a sign-in; returns the first
 * login URL it navigated to.
 */
export async function startSignIn(
  backends: readonly BackendId[],
  next: string,
  deps: SsoDeps,
): Promise<string | null> {
  const first = backends.at(0);
  if (!first) return null;
  const rest = backends.slice(1);
  return redirectToLogin(
    { current: first, todo: rest, next: safeNextPath(next) },
    deps,
  );
}

export type CallbackOutcome =
  /** Navigated to the next backend's login */
  | { kind: "redirect"; url: string }
  /** All done: route to `next` */
  | { kind: "done"; next: string }
  /** The backend reported a failure, or the callback makes no sense */
  | { kind: "error"; backend: BackendId; error: SsoError };

/**
 * What `/auth/callback/<p>?oidc=ok|oidc_error=<msg>` does (deploy/SSO.md §2):
 * an error stops the chain; ok goes on with the next backend, or ends it.
 */
export async function continueSignIn(
  backend: BackendId,
  search: string,
  deps: SsoDeps,
): Promise<CallbackOutcome> {
  const params = new URLSearchParams(search);
  const state = loadSsoState(deps.storage);

  const backendError = params.get("oidc_error");
  if (backendError !== null) {
    clearSsoState(deps.storage);
    return {
      kind: "error",
      backend,
      error: new SsoError(null, backendError || "unknown"),
    };
  }
  if (params.get("oidc") !== "ok") {
    clearSsoState(deps.storage);
    return {
      kind: "error",
      backend,
      error: new SsoError("missingResult", `${backend}: no oidc result`),
    };
  }

  // A callback outside a chain (or for another backend than expected, e.g.
  // a reload of an old URL): this backend is signed in, the rest is up to
  // the app, which checks /me again.
  if (!state || state.current !== backend) {
    clearSsoState(deps.storage);
    return { kind: "done", next: safeNextPath(state?.next) };
  }

  const remaining = state.todo.filter((b) => b !== backend);
  const following = remaining.at(0);
  const rest = remaining.slice(1);
  if (!following) {
    clearSsoState(deps.storage);
    return { kind: "done", next: safeNextPath(state.next) };
  }
  try {
    const url = await redirectToLogin(
      { current: following, todo: rest, next: state.next },
      deps,
    );
    return { kind: "redirect", url };
  } catch (error) {
    clearSsoState(deps.storage);
    return {
      kind: "error",
      backend: following,
      error:
        error instanceof SsoError
          ? error
          : new SsoError("providersUnavailable", String(error)),
    };
  }
}

/** `{"ok":true}`, plus `logoutUrl` when the sign-in came from OIDC */
interface LogoutResponse {
  logoutUrl?: string;
}

/** The end-session URL with `post_logout_redirect_uri` set to the app's root */
export function endSessionUrl(logoutUrl: string, origin: string): string {
  const url = new URL(logoutUrl);
  url.searchParams.set("post_logout_redirect_uri", `${origin}/`);
  return url.toString();
}

export const LOGOUT_URL_STORAGE_KEY = "trace.logoutUrl";

export type SignOutOutcome =
  /** Every backend logged out; the window is on its way to `url` */
  | { kind: "redirect"; url: string }
  /** These backends didn't confirm; nothing navigated, try again */
  | { kind: "incomplete"; failed: BackendId[] };

/**
 * Logout (deploy/SSO.md §4): `POST /<p>/api/auth/oidc/logout` for each
 * backend, then one end-session at the provider so the next sign-in asks for the
 * passkey again.
 *
 * Only when all three confirm does it navigate. Otherwise it reports the
 * backends that failed and stays, so the user can try again. A logoutUrl
 * already handed out is kept in storage for that retry: the backend that
 * gave it has cleared its id_token cookie and won't give it again.
 */
export async function signOut(deps: SsoDeps): Promise<SignOutOutcome> {
  clearSsoState(deps.storage);
  const results = await Promise.all(
    BACKEND_IDS.map(async (backend) => {
      try {
        const response = await deps.fetch(
          apiPath(backend, "/auth/oidc/logout"),
          {
            method: "POST",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) return { backend, isOk: false, logoutUrl: null };
        const body = (await response.json()) as LogoutResponse;
        return { backend, isOk: true, logoutUrl: body.logoutUrl ?? null };
      } catch {
        return { backend, isOk: false, logoutUrl: null };
      }
    }),
  );

  const logoutUrl =
    results.find((result) => result.logoutUrl)?.logoutUrl ??
    deps.storage.getItem(LOGOUT_URL_STORAGE_KEY);
  const failed = results
    .filter((result) => !result.isOk)
    .map((result) => result.backend);

  if (failed.length > 0) {
    if (logoutUrl) deps.storage.setItem(LOGOUT_URL_STORAGE_KEY, logoutUrl);
    return { kind: "incomplete", failed };
  }

  deps.storage.removeItem(LOGOUT_URL_STORAGE_KEY);
  const url = logoutUrl ? endSessionUrl(logoutUrl, deps.origin) : "/";
  deps.navigate(url);
  return { kind: "redirect", url };
}
