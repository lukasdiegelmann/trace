#!/usr/bin/env bash
# Runs ON the server (started by deploy/push.sh, or by hand:
# <root>/src/deploy/deploy.sh). Idempotent.
#   <root>/src      rsynced copy of the repo incl. submodules (push.sh)
#   <root>/secrets  env files, mode 600, never in git
#   <root>/data     SQLite DBs + uploads of nt/ct/lt
# Set up the clients nt, ct, lt at the OIDC provider first and put each one's
# secret into <root>/secrets/<app>.env as OIDC_CLIENT_SECRET.
# Steps: generate JWT secrets once -> check the client secrets -> build +
# start backends and web.
set -euo pipefail
SRC=$(cd "$(dirname "$0")/.." && pwd)
[ "$(basename "$SRC")" = src ] || { echo "run the copy in <root>/src on the server (see push.sh)" >&2; exit 1; }
ROOT=$(dirname "$SRC")
cd "$ROOT"
umask 077
mkdir -p secrets data/{nt,ct,lt}/{db,uploads}

rand() { openssl rand -base64 "$1" | tr -d '\n/+=' ; }
for app in nt ct lt; do
  [ -f secrets/$app.env ] || echo "JWT_SECRET=$(rand 48)" > secrets/$app.env
  grep -q '^OIDC_CLIENT_SECRET=.' secrets/$app.env || {
    echo "$ROOT/secrets/$app.env has no OIDC_CLIENT_SECRET: add the secret of the OIDC client $app" >&2
    exit 1
  }
done

dc() { docker compose -f "$SRC/deploy/compose.yaml" "$@"; }

dc build nt ct lt
dc up -d --remove-orphans
for svc in nt:3101 lt:3102 ct:3103; do
  for i in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:${svc#*:}/${svc%:*}/api/auth/status" && break
    sleep 2
  done
done
dc ps --format '{{.Service}}: {{.State}} {{.Status}} {{.Image}}'
