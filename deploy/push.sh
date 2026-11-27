#!/usr/bin/env bash
# Runs LOCALLY: copies the working tree (with submodules) to the server and
# runs deploy.sh there. No git or deploy key on the server: what you have
# checked out here is what gets built. Commit + push first if you want the
# deployed state to be reproducible.
# apps/web is built here first (its monolithium comes from a private npm
# registry, see .npmrc); the server only serves apps/web/dist.
# Needs DEPLOY_HOST (ssh host) and DEPLOY_ROOT (absolute directory there),
# from the environment or from the untracked deploy/local.env.
#   deploy/push.sh            build + sync + deploy
#   SKIP_BUILD=1 deploy/push.sh   use the apps/web/dist that is there
#   SYNC_ONLY=1 deploy/push.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ ! -f deploy/local.env ] || . deploy/local.env
: "${DEPLOY_HOST:?set DEPLOY_HOST (env or deploy/local.env)}"
: "${DEPLOY_ROOT:?set DEPLOY_ROOT (env or deploy/local.env)}"
[[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]*[A-Za-z0-9._-]$ ]] || { echo "DEPLOY_ROOT must be an absolute path without spaces or a trailing slash" >&2; exit 1; }
git submodule status | grep -q '^-' && { echo "submodules not initialised: git submodule update --init" >&2; exit 1; }
if [ -z "${SKIP_BUILD:-}" ]; then
  pnpm install --frozen-lockfile
  pnpm --filter web build
fi
[ -f apps/web/dist/index.html ] || { echo "apps/web/dist is missing: build apps/web first" >&2; exit 1; }
ssh "$DEPLOY_HOST" "mkdir -p $DEPLOY_ROOT/src && chmod 700 $DEPLOY_ROOT"
rsync -az --delete \
  --exclude .git --exclude node_modules --exclude android --exclude dist \
  --exclude '.env*' --exclude local.env --exclude '*.db' --exclude '*.db-*' \
  ./ "$DEPLOY_HOST:$DEPLOY_ROOT/src/"
# apps/web's build output goes along explicitly (dist is excluded above).
rsync -az --delete apps/web/dist/ "$DEPLOY_HOST:$DEPLOY_ROOT/src/apps/web/dist/"
git rev-parse HEAD | ssh "$DEPLOY_HOST" "cat > $DEPLOY_ROOT/src/DEPLOYED_COMMIT"
[ -n "${SYNC_ONLY:-}" ] || ssh "$DEPLOY_HOST" "$DEPLOY_ROOT/src/deploy/deploy.sh"
