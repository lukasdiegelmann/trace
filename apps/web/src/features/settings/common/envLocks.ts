/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
import { api, type BackendId } from "@/api";

import { useLoad, type Loaded } from "./useLoad";

/** `GET /api/app-config/env-locks`: what the server's environment fixes */
export interface EnvLocks {
  smtp?: boolean;
  ai?: boolean;
  ai_enabled?: boolean;
  ai_provider?: string;
  ai_model?: string;
  oidc_provider_ids?: number[];
  oidc_password_login_locked?: boolean;
  backup_locked?: boolean;
  lifttrace_connected?: boolean;
  off_local?: boolean;
  off_local_only?: boolean;
}

export function useEnvLocks(backend: BackendId): Loaded<EnvLocks> {
  return useLoad(
    () => api[backend].get<EnvLocks>("/app-config/env-locks"),
    [backend],
  );
}
