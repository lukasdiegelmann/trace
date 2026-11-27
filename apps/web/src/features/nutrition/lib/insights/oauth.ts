/**
 * The providers' OAuth callbacks end on `/?<provider>=connected|error&msg=…`
 * (server/routes/{google-health,fitbit,withings,garmin}.js, which don't
 * know the base path).
 */
const PROVIDER_NAMES = {
  google_health: "Fitbit",
  fitbit: "Fitbit",
  withings: "Withings",
  garmin: "Garmin",
} as const;

export const OAUTH_PARAMS = Object.keys(
  PROVIDER_NAMES,
) as (keyof typeof PROVIDER_NAMES)[];

export interface OAuthResult {
  providerName: string;
  isConnected: boolean;
  message: string | null;
}

export function oauthResult(params: URLSearchParams): OAuthResult | null {
  for (const param of OAUTH_PARAMS) {
    const value = params.get(param);
    if (value === "connected" || value === "error") {
      return {
        providerName: PROVIDER_NAMES[param],
        isConnected: value === "connected",
        message: params.get("msg"),
      };
    }
  }
  return null;
}

/** The redirect URI to register at a provider, under NutriTrace's base path */
export function suggestedRedirectUri(
  origin: string,
  provider: "google-health" | "withings" | "garmin",
): string {
  return `${origin}/nt/api/wellness/${provider}/callback`;
}
