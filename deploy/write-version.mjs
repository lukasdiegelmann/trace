// Writes apps/web/dist/version.json, what Settings > About Trace shows about
// the deploy. Run after the build, by the CI deploy job and by push.sh; on the
// server deploy.sh sets deployedAt to the moment of the install.
//   TRACE_DEPLOY_SOURCE  "ci" or "manual" (default)
//   TRACE_RUN_URL        the CI run (ci only)
//   TRACE_SOURCE_URL     the repository the links point to
// Usage: node deploy/write-version.mjs [dist directory]
import { execFileSync } from "node:child_process";
import { chmodSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE_URL = "https://git.monocircuit.net/monocircuit/trace";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = process.argv[2] ?? join(root, "apps/web/dist");
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const env = process.env;
const source = env.TRACE_DEPLOY_SOURCE === "ci" ? "ci" : "manual";
const commit = git("rev-parse", "HEAD");
const repoUrl = (env.TRACE_SOURCE_URL || DEFAULT_SOURCE_URL).replace(/\/+$/, "");

const info = {
  commit,
  commitUrl: `${repoUrl}/commit/${commit}`,
  ref:
    source === "ci" && env.GITHUB_REF_NAME
      ? env.GITHUB_REF_NAME
      : git("rev-parse", "--abbrev-ref", "HEAD"),
  // When this dist was built, also if push.sh did not build it just now.
  builtAt: statSync(join(dist, "index.html")).mtime.toISOString(),
  deployedAt: new Date().toISOString(),
  source,
  ...(source === "ci" && env.TRACE_RUN_URL ? { runUrl: env.TRACE_RUN_URL } : {}),
  repoUrl,
};

const file = join(dist, "version.json");
// One field per line: deploy.sh rewrites the deployedAt line.
writeFileSync(file, `${JSON.stringify(info, null, 2)}\n`);
// The web server reads it, whatever the umask here is.
chmodSync(file, 0o644);
console.log(`version.json: ${source} ${commit}`);
