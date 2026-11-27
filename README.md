# Trace

One web app for nutrition, recipes and lifting, built on
[NutriTrace](https://github.com/TraceApps/nutritrace),
[CookTrace](https://github.com/TraceApps/cooktrace) and
[LiftTrace](https://github.com/TraceApps/lifttrace) (AGPL-3.0), with a
single React UI.

## Layout

| Path | What |
|---|---|
| `apps/web` | The Trace frontend: React + Vite PWA, Monolithium UI ([conventions](apps/web/AGENTS.md)) |
| `backends/{nutritrace,cooktrace,lifttrace}` | Forks (submodules), kept close to upstream so `git pull upstream main` stays easy |
| `deploy/` | Docker Compose and scripts: three backends and web |

The backends run unchanged as their own containers, each mounted under a
path via its `BASE_URL` (`/nt`, `/ct`, `/lt`: API at `/nt/api/...`, the
original UI still at `/nt/`). Login is one OIDC provider shared by all
three.

## Frontend

The UI is built on Monolithium, a component library from a private npm
registry; installing it needs `MONOCIRCUIT_NPM_TOKEN` (a read token) and
`MONOCIRCUIT_NPM_REGISTRY` (see [.npmrc](.npmrc)).

```bash
export MONOCIRCUIT_NPM_REGISTRY=...  # registry URL without https://, ending in /
export MONOCIRCUIT_NPM_TOKEN=...
pnpm install
pnpm --filter web dev                # /nt /ct /lt proxied to TRACE_BACKEND_ORIGIN
pnpm check                           # lint, typecheck, test, build
```

## Deploy

`deploy/compose.yaml` (project `trace`) runs `nt`, `ct`, `lt`, built from the
submodules, and `web` (nginx serving `apps/web/dist`, which `push.sh` builds
locally, so the server needs no registry access). All bind 127.0.0.1; a
reverse proxy in front serves them on one origin (paths:
[compose.yaml](deploy/compose.yaml), one redirect rewrite:
[SSO.md](deploy/SSO.md)). The domain and the OIDC issuer are set in
`compose.yaml`; change them for your own installation.

```bash
export DEPLOY_HOST=...   # ssh host
export DEPLOY_ROOT=...   # directory on that host
deploy/push.sh           # build apps/web, rsync to $DEPLOY_ROOT/src, run deploy.sh there
```

Both variables can also go into the untracked `deploy/local.env`.

`deploy/deploy.sh` (on the server, idempotent) generates secrets once into
`$DEPLOY_ROOT/secrets/*.env` (mode 600, never in git), checks that the OIDC
client secrets are there, and builds and starts the services. At the OIDC
provider, set up the clients `nt`, `ct`, `lt` and the group `trace-admins`,
and put each client's secret into its env file as `OIDC_CLIENT_SECRET=...`.
Data lives in `$DEPLOY_ROOT/data`. How the frontend signs in to all three
backends at once: [deploy/SSO.md](deploy/SSO.md).

## Updating a backend from upstream

```bash
cd backends/nutritrace
git fetch upstream && git merge upstream/main && git push
cd ../.. && git add backends/nutritrace && git commit -m "Bump nutritrace"
```

## License

AGPL-3.0, like the three upstream apps.
