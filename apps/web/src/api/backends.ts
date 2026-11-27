/** The three backends behind the one origin (deploy/SSO.md, "Layout") */
export const BACKEND_IDS = ["nt", "ct", "lt"] as const;

export type BackendId = (typeof BACKEND_IDS)[number];

/** NutriTrace and CookTrace check `X-CSRF-Token` on unsafe methods; LiftTrace doesn't */
export const BACKEND_NEEDS_CSRF: Record<BackendId, boolean> = {
  nt: true,
  ct: true,
  lt: false,
};

export function isBackendId(value: string | undefined): value is BackendId {
  return BACKEND_IDS.includes(value as BackendId);
}

/** `/nt/api/foods` for `apiPath("nt", "/foods")`: always relative, same origin */
export function apiPath(backend: BackendId, path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`API path must start with "/": ${path}`);
  }
  return `/${backend}/api${path}`;
}
