#!/usr/bin/env bash
# Runs ON the server (started by deploy/push.sh, or by hand:
# <root>/src/deploy/deploy.sh). Idempotent.
#   <root>/src      rsynced copy of the repo incl. submodules (push.sh)
#   <root>/secrets  env files, mode 600, never in git
#   <root>/data     SQLite DBs + uploads of nt/ct/lt
# Set up the clients nt, ct, lt at the OIDC provider first and put each one's
# secret into <root>/secrets/<app>.env as OIDC_CLIENT_SECRET. Put the origin
# and the issuer into <root>/secrets/trace.env (see .env.example).
# Steps: check trace.env -> generate JWT secrets once -> check the client
# secrets -> build + start backends and web -> set deployedAt in version.json.
set -euo pipefail
SRC=$(cd "$(dirname "$0")/.." && pwd)
[ "$(basename "$SRC")" = src ] || { echo "run the copy in <root>/src on the server (see push.sh)" >&2; exit 1; }
ROOT=$(dirname "$SRC")
cd "$ROOT"
umask 077
mkdir -p secrets data/{nt,ct,lt}/{db,uploads}

for var in TRACE_ORIGIN OIDC_ISSUER; do
  grep -q "^$var=." secrets/trace.env 2>/dev/null || {
    echo "$ROOT/secrets/trace.env has no $var: see deploy/.env.example" >&2
    exit 1
  }
done

rand() { openssl rand -base64 "$1" | tr -d '\n/+=' ; }
for app in nt ct lt; do
  [ -f secrets/$app.env ] || echo "JWT_SECRET=$(rand 48)" > secrets/$app.env
  grep -q '^OIDC_CLIENT_SECRET=.' secrets/$app.env || {
    echo "$ROOT/secrets/$app.env has no OIDC_CLIENT_SECRET: add the secret of the OIDC client $app" >&2
    exit 1
  }
done

dc() {
  docker compose --env-file "$ROOT/secrets/trace.env" \
    -f "$SRC/deploy/compose.yaml" "$@"
}

dc build nt ct lt
dc up -d --remove-orphans
# web-nginx.conf is mounted as a single file: a sync replaces the file, and
# only a new container sees the new one.
dc up -d --no-deps --force-recreate web
for svc in nt:3101 lt:3102 ct:3103; do
  url="http://127.0.0.1:${svc#*:}/${svc%:*}/api/auth/status"
  for i in $(seq 1 60); do
    curl -sf -o /dev/null "$url" && break
    [ "$i" -lt 60 ] || { echo "${svc%:*} does not answer: $url" >&2; exit 1; }
    sleep 2
  done
done
# The install is done: that is when this version was deployed.
VERSION_JSON=$SRC/apps/web/dist/version.json
if [ -f "$VERSION_JSON" ]; then
  sed -i "s/\"deployedAt\": \"[^\"]*\"/\"deployedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"/" "$VERSION_JSON"
fi
dc ps --format '{{.Service}}: {{.State}} {{.Status}} {{.Image}}'
