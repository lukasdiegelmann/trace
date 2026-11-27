import { useCallback, useState } from "react";

import {
  getAppConfig,
  getConfig,
  getEnvLocks,
  getStatus,
  type AppConfig,
  type ProviderConfig,
} from "../api";
import { useAsync } from "../useAsync";
import type { ConfigProvider, Credentials } from "./credentials";

function credentialsOf(
  provider: ConfigProvider,
  config: ProviderConfig,
  defaults: AppConfig | null,
): Credentials {
  const prefix =
    provider === "google-health" ? "google_health" : ("withings" as const);
  // Admins see the server-wide credentials where they have none of their own
  const shared = provider === "garmin" ? null : defaults;
  return {
    id:
      (provider === "garmin" ? config.consumer_key : config.client_id) ||
      shared?.[`${prefix}_client_id`] ||
      "",
    secret: shared?.[`${prefix}_client_secret`] || "",
    redirectUri:
      config.redirect_uri || shared?.[`${prefix}_redirect_uri`] || "",
  };
}

/** Connection status and OAuth credentials of every provider */
export function useWellnessConfig() {
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);
  const load = useCallback(async () => {
    const [google, withings, garmin, app, locks] = await Promise.all([
      getConfig("google-health"),
      getConfig("withings"),
      getConfig("garmin"),
      getAppConfig(),
      getEnvLocks(),
    ]);
    const [googleStatus, fitbitStatus, withingsStatus, garminStatus] =
      await Promise.all([
        getStatus("google-health"),
        getStatus("fitbit"),
        getStatus("withings"),
        getStatus("garmin"),
      ]);
    return {
      version,
      credentials: {
        "google-health": credentialsOf("google-health", google, app),
        withings: credentialsOf("withings", withings, app),
        garmin: credentialsOf("garmin", garmin, app),
      },
      status: {
        "google-health": googleStatus,
        withings: withingsStatus,
        garmin: garminStatus,
      },
      /** Tokens of the retired Fitbit Web API, not yet re-linked */
      hasLegacyFitbit: fitbitStatus.connected && !googleStatus.connected,
      fitbitUserId: fitbitStatus.fitbitUserId ?? googleStatus.fitbitUserId,
      hasLiftTrace: !!locks.lifttrace_connected,
    };
  }, [version]);
  return { config: useAsync(load).data, reload };
}
