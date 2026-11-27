import { useEffect, useState } from "react";

import { api } from "@/api";
import { useSettings } from "@/features/shared/settings";

import type { AiConfig } from "../lib/aiChat";

/* eslint-disable @typescript-eslint/naming-convention -- CookTrace's JSON */
interface EnvLocks {
  ai?: boolean;
  ai_enabled?: boolean;
}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Whether "Scan Label" is offered and how it reaches the AI (the old
 * aiEffectivelyEnabled): the user's own setup, or the server's env one.
 */
export function useAiLabelScan(): {
  isAvailable: boolean;
  shouldUseProxy: boolean;
  config: AiConfig;
} {
  const { values } = useSettings("ct");
  const [locks, setLocks] = useState<EnvLocks>({});
  useEffect(() => {
    let isStale = false;
    api.ct
      .get<EnvLocks>("/app-config/env-locks")
      .then((next) => {
        if (!isStale) setLocks(next);
      })
      .catch(() => {
        // Without an answer only the user's own AI setup counts.
      });
    return () => {
      isStale = true;
    };
  }, []);
  return {
    isAvailable:
      values.aiEnabled || (Boolean(locks.ai) && Boolean(locks.ai_enabled)),
    shouldUseProxy: Boolean(locks.ai),
    config: {
      provider: values.aiProvider,
      apiKey: values.aiApiKey,
      model: values.aiModel,
      baseUrl: values.aiBaseUrl,
    },
  };
}
