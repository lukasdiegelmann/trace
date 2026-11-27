import type { ProviderConfig } from "../api";

export type ConfigProvider = "google-health" | "withings" | "garmin";

export interface Credentials {
  id: string;
  secret: string;
  redirectUri: string;
}

/** The provider's JSON field names: Garmin calls them consumer key and secret */
export function toConfig(
  provider: ConfigProvider,
  credentials: Credentials,
): ProviderConfig {
  const secret = credentials.secret || undefined;
  return provider === "garmin"
    ? {
        consumer_key: credentials.id,
        consumer_secret: secret,
        redirect_uri: credentials.redirectUri,
      }
    : {
        client_id: credentials.id,
        client_secret: secret,
        redirect_uri: credentials.redirectUri,
      };
}
