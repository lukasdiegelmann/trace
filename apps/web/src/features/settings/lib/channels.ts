import { api, BACKEND_IDS, type BackendId } from "@/api";

export const PUSH_SERVICES = ["none", "apprise", "gotify", "ntfy"] as const;
export type PushService = (typeof PUSH_SERVICES)[number];

export interface ChannelFields {
  appriseUrl: string;
  gotifyUrl: string;
  gotifyToken: string;
  ntfyUrl: string;
  ntfyTopic: string;
}

/** The old UI's "Configured" rule: the fields a service can't do without */
export function isPushConfigured(
  service: string,
  fields: ChannelFields,
): boolean {
  switch (service) {
    case "gotify":
      return Boolean(fields.gotifyUrl && fields.gotifyToken);
    case "ntfy":
      return Boolean(fields.ntfyUrl && fields.ntfyTopic);
    case "apprise":
      return Boolean(fields.appriseUrl);
    default:
      return false;
  }
}

export interface TestResult {
  backend: BackendId;
  error: string | null;
}

/**
 * A test message from each backend's own server, over the saved settings.
 * CookTrace tests through /notify/test, the others through push-test.
 */
export async function sendTestPush(service: string): Promise<TestResult[]> {
  return Promise.all(
    BACKEND_IDS.map(async (backend) => {
      try {
        if (backend === "ct") await api.ct.post("/notify/test", {});
        else await api[backend].post("/settings/push-test", { service });
        return { backend, error: null };
      } catch (caught) {
        return {
          backend,
          error: caught instanceof Error ? caught.message : String(caught),
        };
      }
    }),
  );
}
