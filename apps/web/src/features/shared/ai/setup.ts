/**
 * How AI is set up. The settings are the same in all three apps (Settings >
 * Trace AI writes them to each); the assistant reads NutriTrace's, and its
 * server's environment locks.
 */
import { useEffect, useState } from "react";

import { api } from "@/api";
import { settingsStores, useSettings } from "@/features/shared/settings";

import type { AiConfig } from "./types";

/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
export interface AiLocks {
  /** The server's environment configures AI: requests go through it */
  ai?: boolean;
  ai_enabled?: boolean;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface AiSetup {
  /** The assistant is on (the old aiEffectivelyEnabled) */
  isEnabled: boolean;
  /** On, and able to reach a model: a key, a keyless endpoint or the server */
  isUsable: boolean;
  shouldUseProxy: boolean;
  config: AiConfig;
  assistantName: string;
}

export function aiSetup(
  values: {
    aiEnabled?: unknown;
    aiProvider?: unknown;
    aiApiKey?: unknown;
    aiModel?: unknown;
    aiBaseUrl?: unknown;
    aiAssistantName?: unknown;
  },
  locks: AiLocks,
): AiSetup {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const config: AiConfig = {
    provider: text(values.aiProvider) || "claude",
    apiKey: text(values.aiApiKey),
    model: text(values.aiModel),
    baseUrl: text(values.aiBaseUrl),
  };
  const shouldUseProxy = Boolean(locks.ai);
  const isEnabled =
    Boolean(values.aiEnabled) || Boolean(locks.ai && locks.ai_enabled);
  const isKeyless =
    (config.provider === "oai-compat" || config.provider === "custom") &&
    Boolean(config.baseUrl);
  return {
    isEnabled,
    isUsable:
      isEnabled && (shouldUseProxy || Boolean(config.apiKey) || isKeyless),
    shouldUseProxy,
    config,
    assistantName: text(values.aiAssistantName).trim() || "Trace",
  };
}

async function loadLocks(): Promise<AiLocks> {
  try {
    const locks = await api.nt.get<AiLocks | null | undefined>(
      "/app-config/env-locks",
    );
    return locks ?? {};
  } catch {
    // Without an answer only the user's own setup counts.
    return {};
  }
}

/** For code outside React */
export async function loadAiSetup(): Promise<AiSetup> {
  const [locks] = await Promise.all([
    loadLocks(),
    settingsStores.nt.ensureLoaded(),
  ]);
  return aiSetup(settingsStores.nt.getSnapshot().values, locks);
}

export function useAiSetup(): AiSetup {
  const { values } = useSettings("nt");
  const [locks, setLocks] = useState<AiLocks>({});
  useEffect(() => {
    let isStale = false;
    void loadLocks().then((next) => {
      if (!isStale) setLocks(next);
    });
    return () => {
      isStale = true;
    };
  }, []);
  return aiSetup(values, locks);
}
