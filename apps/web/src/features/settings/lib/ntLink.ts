export interface NtTestAnswer {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the backend's field
  ok: boolean;
  error?: string;
  user?: {
    username?: string | null;
    full_name?: string | null;
    name?: string | null;
  } | null;
}

/** A name for the connection: the account if the server tells, else the host */
export function connectionName(answer: NtTestAnswer, url: string): string {
  const user = answer.user;
  const name = user?.username || user?.name || user?.full_name;
  if (name) return name;
  return URL.canParse(url) ? new URL(url).host : url;
}

/**
 * CookTrace's test asks NutriTrace's /api/auth/me, which knows session
 * tokens only: it answers `user: null` to every API token, good or bad, so
 * it only shows that the address answers. The token is proven by a call
 * that uses it, CookTrace's food search (NutriTrace's /api/v1/foods).
 */
export const CHECK_QUERY = "trace-connection-check";
