# SSO contract for the Trace frontend

How `apps/web` gets a session in all three backends with one sign-in at the
OIDC provider. Everything below follows from deploy/compose.yaml, the reverse
proxy in front (one rewrite, see step 2) and the unchanged backend code;
file:line references are into the submodules at
nutritrace 888c966, cooktrace f2734f0, lifttrace bfde1fe. Re-check them after
a submodule bump.

## Layout (one origin)

| Prefix | Backend | Cookie | CSRF header needed |
|---|---|---|---|
| `/nt/` | NutriTrace (`BASE_URL=/nt`) | `nt_token` (+ `nt_oidc_logout`) | yes, `X-CSRF-Token` |
| `/ct/` | CookTrace (`BASE_URL=/ct`) | `ct_token` (+ `ct_oidc_logout`) | yes, `X-CSRF-Token` |
| `/lt/` | LiftTrace (`BASE_URL=/lt`) | `lt_token` (+ `lt_oidc_logout`) | no |
| everything else | `web` (the frontend, SPA fallback to `index.html`) | | |

- Origin: where your instance is served (`TRACE_ORIGIN`, e.g. `https://trace.example.com`), called `<origin>` below. IdP: your OIDC issuer (`OIDC_ISSUER`, see [.env.example](.env.example)), called `<issuer>` below; clients `nt`, `ct`, `lt`, consent off, PKCE S256.
- Each backend mounts its whole router under its prefix (`app.use(BASE_URL || '/', router)`: nutritrace/server/index.js:407, cooktrace/server/index.js:302, lifttrace/server/index.js:292), so API = `/<p>/api/...`, uploads = `/<p>/uploads/...`, and the original UI stays at `/<p>/`.
- Cookies are set without `path`, so they have `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` (`COOKIE_OPTS`: nutritrace/server/routes/oidc.js:23, cooktrace/server/routes/oidc.js:23, lifttrace/server/routes/oidc.js:21). The names differ per backend, so all three can be set at once. The frontend cannot read them; it sends them by calling with `credentials: 'same-origin'` (the `fetch` default).
- CORS: same host only. Keep every call relative (`/nt/api/...`).

## 1. Find out what is needed

For each backend `p` in `nt`, `ct`, `lt`:

```
GET /<p>/api/auth/me
  nt -> {"user": {...}|null, "csrf": "<hex>"|null, "features": {...}}   nutritrace/server/routes/auth.js:168-172
  ct -> {"user": {...}|null, "csrf": "<hex>"|null}                      cooktrace/server/routes/auth.js:156-159
  lt -> {"user": {...}|null, ...}  (no csrf field)                      lifttrace/server/routes/auth.js:170-176
```

`user: null` means that backend needs a sign-in. Take the provider ID from

```
GET /<p>/api/auth/oidc/providers
  -> {"providers":[{"id":1,"display_name":"...",...}], "enable_email_password_login": true}
```

(nutritrace/server/routes/oidc.js:49, cooktrace/server/routes/oidc.js:49,
lifttrace/server/routes/oidc.js:40). Today it is `1` in all three (seeded
from env), but read it, don't hardcode it. `/<p>/api/auth/status` carries the
same list under `oidc.providers`.

## 2. Sign in: one top-level redirect per backend

Keep the list of backends still to do in `sessionStorage` (e.g.
`trace.sso = {"todo":["ct","lt"],"next":"/diary"}`), then navigate the whole
window (not fetch, not an iframe: the provider's sign-in page needs a
top-level page) to:

```
/<p>/api/auth/oidc/login/<providerId>?return=<encodeURIComponent("/__trace/auth/callback/<p>")>
```

- Handler: nutritrace/server/routes/oidc.js:63-105 (cooktrace 63-105,
  lifttrace 48-90). It stores state, nonce and the PKCE verifier and 302s to
  the authorization endpoint of `<issuer>` with `client_id=<p>&redirect_uri=<origin>/<p>/api/auth/oidc/callback&scope=openid profile email groups&...`.
- `return` is kept up to 256 characters (oidc.js:83 in nt/ct, :68 in lt).
  It must be a path without a query string; put any state in
  `sessionStorage` instead.
- Don't send `link=1` or `mobile=1` (account linking and the Android app).

The provider then shows its sign-in the first time. For the second and
third backend its session cookie is already there and the clients skip
consent, so `/authorize` goes straight back without a prompt.

The callback `/<p>/api/auth/oidc/callback` (handleCallback:
nutritrace/server/routes/oidc.js:117-233, cooktrace 117-234, lifttrace
100-213) swaps the code for tokens, finds or creates the user, sets
`<p>_token` (nt :222, ct :223, lt :202) and `<p>_oidc_logout` (the
id_token for logout; nt :225, ct :226, lt :205), then redirects via
`_redirectToLogin` (nt :249-259, ct :250-260, lt :229-238) to

```
/<p>/#<return>?oidc=ok            success
/<p>/#<return>?oidc_error=<msg>   failure (msg is already URL-encoded)
```

That URL would load the bundled original UI, so **the reverse proxy rewrites
it**: on responses under `/<p>/*` it replaces the `Location` header matching
`^/<p>/#/__trace(/[^?]*)(.*)$` with `$1$2`,
so with `return=/__trace/auth/callback/<p>` the browser lands on

```
<origin>/auth/callback/<p>?oidc=ok
<origin>/auth/callback/<p>?oidc_error=callback_failed
```

A `return` without
the `/__trace` prefix is left alone and lands in the original UI, which is
how the fallback UIs keep working.

On `/auth/callback/<p>` the frontend:
1. on `oidc_error`: shows the decoded message and stops the chain;
2. on `oidc=ok`: takes the next backend from `sessionStorage` and navigates
   to its login URL (step 2 again); when none is left, clears the entry and
   routes to `next`;
3. fetches `/<p>/api/auth/me` for each backend to pick up the CSRF tokens
   (step 3).

Users and admin rights: each backend auto-registers the provider's user on
first sign-in (`OIDC_AUTO_REGISTER=1`; `resolveUser`:
nutritrace/server/lib/oidc.js:212, cooktrace :214, lifttrace :210). Admin
comes from the `groups` claim containing `trace-admins`
(`applyAdminMapping` nt :299, ct :301, lt :284; it runs on every sign-in, so
removing the group at the provider removes admin on the next sign-in). The very
first user of an empty backend is made admin anyway (routes/oidc.js:186 in
nt/ct, :168 in lt). Each backend has its own user row and ID; the link
between them is the provider's `sub`.

Switching the IdP: the backends key their provider row on (issuer_url,
client_id), so a new issuer in the env would add a second provider next to
the old one. Instead, with the backends stopped, move the row and drop its
links in each DB:
`UPDATE oidc_providers SET issuer_url='<new>' WHERE issuer_url='<old>'`,
`DELETE FROM user_oidc_links WHERE oidc_provider_id=<that id>`. The first
sign-in with the new IdP then links the existing user again by verified
email (`OIDC_AUTO_LINK`), keeping its data.

Before its first user exists, NutriTrace and CookTrace answer every
`/api/*` outside `/api/auth/*` with `503 {"setup_required":true}`
(nutritrace/server/index.js:212-218, cooktrace/server/index.js:200-207),
`/api/health` included. A completed sign-in clears that. LiftTrace has no
such gate.

## 3. CSRF tokens and API calls

- NT and CT: every non-GET/HEAD/OPTIONS request with a cookie session must
  send `X-CSRF-Token: <csrf from /<p>/api/auth/me>` or gets
  `403 {"error":"Invalid CSRF token"}` (nutritrace/server/middleware/csrf.js:22-43,
  cooktrace/server/middleware/csrf.js same lines; wired at
  nutritrace/server/index.js:188, cooktrace/server/index.js:164). The token
  is a random value inside the session JWT (middleware/auth.js:35), so it
  stays the same for the life of the cookie: fetch it once after sign-in and
  again after any 401/403. `/api/auth/*` is exempt (csrf.js:8), so login and
  logout need none.
- LT: no CSRF check; just send the cookie.
- 401 from a backend: its session is gone (expired or logged out); run step
  2 for that backend only.

## 4. Logout

For each backend:

```
POST /<p>/api/auth/oidc/logout      (no body, no CSRF header needed)
  -> {"ok":true}  or  {"ok":true,"logoutUrl":"<the issuer's end-session endpoint>?post_logout_redirect_uri=...&id_token_hint=..."}
```

(nutritrace/server/routes/oidc.js:266-317, cooktrace :270-321, lifttrace
:248-297). It clears `<p>_token` and `<p>_oidc_logout`; `logoutUrl` is
present when that backend's sign-in came from OIDC. Its
`post_logout_redirect_uri` is `<origin>/<p>/`
(nt :305, ct :307, lt :285).

Then end the provider's session (otherwise the next sign-in goes through
without asking): take one `logoutUrl`, set its `post_logout_redirect_uri`
to `<origin>/` (both values are registered as
logout callback URLs on every client) and navigate the window there. The
provider checks the `id_token_hint`, clears its own cookie and redirects back. One
end-session call is enough for the browser session; the other two
backends' cookies are already cleared by their POSTs. The plain
`POST /<p>/api/auth/logout` (nt auth.js:196, ct :183, lt :200) clears only
the local cookie.
