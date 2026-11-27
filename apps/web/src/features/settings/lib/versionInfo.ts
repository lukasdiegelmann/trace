/**
 * What the server says about its deploy: /version.json, written next to the
 * app when it is deployed (deploy/write-version.mjs), not part of the bundle.
 */
export interface VersionInfo {
  /** Full commit SHA of the deployed tree */
  commit: string;
  commitUrl?: string;
  ref?: string;
  builtAt?: string;
  deployedAt?: string;
  source?: "ci" | "manual";
  /** The CI run that deployed it */
  runUrl?: string;
  repoUrl?: string;
}

export const VERSION_URL = "/version.json";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function webUrl(value: unknown): string | undefined {
  const url = text(value);
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

function time(value: unknown): string | undefined {
  const at = text(value);
  return at && !Number.isNaN(Date.parse(at)) ? at : undefined;
}

/** null without a commit; every other field that is off is left out */
export function parseVersionInfo(value: unknown): VersionInfo | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const commit = text(raw.commit);
  if (!commit || !/^[0-9a-f]{7,64}$/i.test(commit)) return null;
  return {
    commit,
    commitUrl: webUrl(raw.commitUrl),
    ref: text(raw.ref),
    builtAt: time(raw.builtAt),
    deployedAt: time(raw.deployedAt),
    source:
      raw.source === "ci" || raw.source === "manual" ? raw.source : undefined,
    runUrl: webUrl(raw.runUrl),
    repoUrl: webUrl(raw.repoUrl),
  };
}

/**
 * Asks the server, past every cache. null when there is nothing to show: no
 * such file (the dev server answers with the app page), or no connection.
 */
export async function fetchVersionInfo(
  fetchImpl: typeof fetch = fetch,
): Promise<VersionInfo | null> {
  try {
    const response = await fetchImpl(VERSION_URL, { cache: "no-store" });
    if (!response.ok) return null;
    return parseVersionInfo(await response.json());
  } catch {
    return null;
  }
}

/**
 * Whether the running bundle was built from another commit than the deployed
 * one. False while either is unknown.
 */
export function isBundleOutdated(
  buildCommit: string,
  info: VersionInfo | null,
): boolean {
  if (!buildCommit || !info) return false;
  return buildCommit.toLowerCase() !== info.commit.toLowerCase();
}

export function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}
