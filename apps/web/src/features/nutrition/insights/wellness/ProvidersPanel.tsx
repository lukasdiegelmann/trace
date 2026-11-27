import { Button, Chip, Stack, Text } from "@monocircuit/monolithium/components";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { relativeTime } from "../../lib/insights/dates";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";
import type { LastSync } from "./lastSync";
import type { SyncProviderId } from "./useWellnessSync";

export interface ConnectedProvider {
  id: SyncProviderId;
  /** The account at the provider, when it says */
  account?: string | null;
}

export interface ProvidersPanelProps {
  providers: ConnectedProvider[];
  syncing: SyncProviderId[];
  lastSync: LastSync | null;
  onSync: (provider: SyncProviderId) => Promise<void>;
  onManage: () => void;
}

const NAMES: Record<SyncProviderId, string> = {
  fitbit: "Fitbit",
  garmin: "Garmin",
  withings: "Withings",
};

/** How often the "5 min ago" label is redone */
const TICK_MS = 30_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return now;
}

export function ProvidersPanel(props: ProvidersPanelProps) {
  const { t, locale } = useInsightsT();
  const now = useNow();
  const isSyncing = props.syncing.length > 0;
  const ago = props.lastSync
    ? relativeTime(props.lastSync.at, Math.max(now, props.lastSync.at))
    : null;

  async function syncAll() {
    for (const provider of props.providers) await props.onSync(provider.id);
  }

  return (
    <SectionCard title={t("wellness.providers.title")}>
      <Stack gap={2}>
        {props.providers.map(({ id, account }) => {
          const isBusy = props.syncing.includes(id);
          return (
            <div key={id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Text as="span" variant="small" isTruncated>
                  {NAMES[id]}
                </Text>
                <Chip
                  tone={isBusy ? "muted" : "accent"}
                  text={t(
                    isBusy
                      ? "wellness.providers.syncing"
                      : "wellness.providers.connected",
                  )}
                />
              </span>
              <Button
                size="sm"
                variant="secondary"
                isLoading={isBusy}
                aria-label={
                  account
                    ? t("wellness.providers.syncAccount", {
                        provider: NAMES[id],
                        account,
                      })
                    : t("wellness.providers.sync", { provider: NAMES[id] })
                }
                onClick={() => void props.onSync(id)}
              >
                <RefreshCw aria-hidden size={16} />
              </Button>
            </div>
          );
        })}
        {props.providers.length > 1 ? (
          <Button
            variant="primary"
            size="sm"
            isFullWidth
            isDisabled={isSyncing}
            text={t("wellness.providers.syncAll")}
            onClick={() => void syncAll()}
          />
        ) : null}
        {ago && props.lastSync ? (
          <Text variant="caption">
            {t("wellness.providers.lastSync", {
              provider: props.lastSync.provider,
              time:
                ago.unit === "date"
                  ? ago.date.toLocaleDateString(locale)
                  : t(`wellness.relative.${ago.unit}`, {
                      count: "count" in ago ? ago.count : 0,
                    }),
            })}
          </Text>
        ) : null}
        <Button
          size="sm"
          text={t("wellness.providers.manage")}
          onClick={props.onManage}
        >
          <SlidersHorizontal aria-hidden size={14} />
        </Button>
      </Stack>
    </SectionCard>
  );
}
