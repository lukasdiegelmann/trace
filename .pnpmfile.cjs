// The private registry's tarball paths differ from npm's default, so pnpm
// would write its absolute URL into pnpm-lock.yaml. Keep the path relative:
// pnpm resolves it against the registry from .npmrc.
const scope = "@monocircuit/";

function afterAllResolved(lockfile) {
  const host = process.env.MONOCIRCUIT_NPM_REGISTRY;
  if (!host) return lockfile;
  const registry = `https://${host}`;
  for (const [key, snapshot] of Object.entries(lockfile.packages ?? {})) {
    const tarball = snapshot.resolution?.tarball;
    if (key.startsWith(scope) && tarball?.startsWith(registry)) {
      snapshot.resolution.tarball = tarball.slice(registry.length);
    }
  }
  return lockfile;
}

module.exports = { hooks: { afterAllResolved } };
