/**
 * NutriTrace calls of Statistics and Wellness (nt server routes
 * wellness/{fitbit,google-health,garmin,withings}, diary, fasts, settings,
 * app-config).
 */
/* eslint-disable @typescript-eslint/naming-convention -- the backend's JSON keys */
import { api } from "@/api";

import type { Fast } from "../lib/insights/fasting";
import type {
  DiaryDay,
  WellnessByDate,
  WithingsByDate,
} from "../lib/insights/statistics";

export type Provider = "fitbit" | "google-health" | "garmin" | "withings";

/** `GET /api/wellness/<provider>/status` (fields differ per provider) */
export interface ProviderStatus {
  connected: boolean;
  configured: boolean;
  fitbitUserId?: string | null;
  googleUserId?: string | null;
  garminUserId?: string | null;
  withingsUserId?: string | null;
  lastSyncedAt?: string | null;
  expiresAt?: string | null;
}

const DISCONNECTED: ProviderStatus = { connected: false, configured: false };

/** A provider's status; an error reads as "not connected" like the original */
export async function getStatus(provider: Provider): Promise<ProviderStatus> {
  try {
    return await api.nt.get<ProviderStatus>(`/wellness/${provider}/status`);
  } catch {
    return DISCONNECTED;
  }
}

export interface DayQuery {
  date?: string;
  from?: string;
  to?: string;
}

/** fitbit + health_connect + federation rows, merged by the server */
export function getFitbitData(query: DayQuery): Promise<WellnessByDate> {
  return api.nt.get<WellnessByDate>("/wellness/fitbit/data", {
    query: { ...query },
  });
}

export function getGarminData(query: DayQuery): Promise<WellnessByDate> {
  return api.nt.get<WellnessByDate>("/wellness/garmin/data", {
    query: { ...query },
  });
}

export function getWithingsData(query: DayQuery): Promise<WithingsByDate> {
  return api.nt.get<WithingsByDate>("/wellness/withings/data", {
    query: { ...query },
  });
}

/** A fetch that falls back to `{}` when the source is off or fails */
export async function orEmpty<T extends object>(
  isEnabled: boolean,
  load: () => Promise<T>,
): Promise<T> {
  if (!isEnabled) return {} as T;
  try {
    return await load();
  } catch {
    return {} as T;
  }
}

export function getAllDiary(): Promise<DiaryDay[]> {
  return api.nt.get<DiaryDay[]>("/diary");
}

/**
 * Calls that reach the wearable's provider: NutriTrace answers them with
 * 401 when the provider's grant is gone, which is not our session.
 */
const PROVIDER_CALL = { shouldVerify401: true } as const;

export interface FitbitSyncResult {
  ok?: boolean;
  metrics?: Record<string, number | null>;
  synced?: number;
  rateLimited?: boolean;
}

export function syncFitbit(body: DayQuery): Promise<FitbitSyncResult> {
  return api.nt.post<FitbitSyncResult>(
    "/wellness/fitbit/sync",
    body,
    PROVIDER_CALL,
  );
}

export interface RangeSyncResult {
  ok?: boolean;
  synced?: number;
  dates?: number;
  count?: number;
  results?: Record<string, { ok: boolean; count?: number; error?: string }>;
}

export function syncProvider(
  provider: "garmin" | "withings" | "google-health",
  body: DayQuery,
): Promise<RangeSyncResult> {
  return api.nt.post<RangeSyncResult>(
    `/wellness/${provider}/sync`,
    body,
    PROVIDER_CALL,
  );
}

/** The provider's OAuth URL; the caller navigates the whole window there */
export async function authorizeUrl(
  provider: "google-health" | "garmin" | "withings",
): Promise<string> {
  const { url } = await api.nt.get<{ url: string }>(
    `/wellness/${provider}/authorize`,
  );
  return url;
}

export function disconnect(provider: Provider): Promise<unknown> {
  return api.nt.delete(`/wellness/${provider}/disconnect`);
}

/** `GET|PUT /api/wellness/<provider>/config` */
export interface ProviderConfig {
  client_id?: string;
  client_secret?: string;
  consumer_key?: string;
  consumer_secret?: string;
  redirect_uri?: string;
}

export async function getConfig(
  provider: "google-health" | "garmin" | "withings",
): Promise<ProviderConfig> {
  try {
    return await api.nt.get<ProviderConfig>(`/wellness/${provider}/config`);
  } catch {
    return {};
  }
}

export function saveConfig(
  provider: "google-health" | "garmin" | "withings",
  config: ProviderConfig,
): Promise<unknown> {
  return api.nt.put(`/wellness/${provider}/config`, config);
}

/** Admin-only server defaults (`GET /api/app-config`) */
export interface AppConfig {
  google_health_client_id?: string;
  google_health_client_secret?: string;
  google_health_redirect_uri?: string;
  withings_client_id?: string;
  withings_client_secret?: string;
  withings_redirect_uri?: string;
}

export async function getAppConfig(): Promise<AppConfig | null> {
  try {
    return await api.nt.get<AppConfig>("/app-config");
  } catch {
    return null;
  }
}

export interface EnvLocks {
  lifttrace_connected?: boolean;
}

export async function getEnvLocks(): Promise<EnvLocks> {
  try {
    return await api.nt.get<EnvLocks>("/app-config/env-locks");
  } catch {
    return {};
  }
}

/** A row of `workouts` (`GET /api/wellness/fitbit/workouts`) */
export interface Workout {
  id: number;
  source_id: string;
  date: string;
  activity_name: string | null;
  start_time: string | null;
  duration_ms: number | null;
  distance_km: number | null;
  calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  steps: number | null;
  has_gps: boolean;
  gps_data?: GpsPoint[] | null;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  hr: number | null;
  alt: number | null;
  time: string | null;
}

export function getWorkouts(date: string): Promise<Workout[]> {
  return api.nt.get<Workout[]>("/wellness/fitbit/workouts", {
    query: { date },
  });
}

export function syncWorkouts(from: string, to: string): Promise<unknown> {
  return api.nt.post(
    "/wellness/fitbit/workouts/sync",
    { from, to },
    PROVIDER_CALL,
  );
}

export async function loadGps(sourceId: string): Promise<GpsPoint[] | null> {
  const result = await api.nt.post<{ gps_data?: GpsPoint[] | null }>(
    `/wellness/fitbit/workouts/${encodeURIComponent(sourceId)}/gps`,
    undefined,
    PROVIDER_CALL,
  );
  return result.gps_data ?? null;
}

export async function getFasting(): Promise<{
  active: Fast | null;
  history: Fast[];
}> {
  const [active, history] = await Promise.all([
    api.nt.get<Fast | null>("/fasts/active").catch(() => null),
    api.nt.get<Fast[]>("/fasts", { query: { limit: 60 } }).catch(() => []),
  ]);
  return {
    active: active ?? null,
    history: Array.isArray(history) ? history : [],
  };
}

export function deleteFast(id: number): Promise<unknown> {
  return api.nt.delete(`/fasts/${id}`);
}
