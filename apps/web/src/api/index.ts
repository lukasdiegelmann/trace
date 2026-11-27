import { BACKEND_IDS, type BackendId } from "./backends";
import { createApiClient, type ApiClient } from "./client";

export * from "./backends";
export * from "./client";
export * from "./errors";

type SessionExpiredListener = (backend: BackendId) => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribes to 401s from any backend; returns the unsubscribe */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

/** The app's clients: `api.nt.get("/foods")`, `api.lt.post("/workouts", body)` */
export const api = Object.fromEntries(
  BACKEND_IDS.map((backend) => [
    backend,
    createApiClient(backend, {
      onSessionExpired: (expired) => {
        for (const listener of sessionExpiredListeners) listener(expired);
      },
    }),
  ]),
) as Record<BackendId, ApiClient>;
