import {
  Button,
  Chip,
  ExternalLink,
  ProgressBar,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";

import { useAdminBackends } from "../common/admin";
import { SelectRow } from "../common/fields";
import { LoadState, Section } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useLoad } from "../common/useLoad";
import {
  formatBytes,
  offMirrorState,
  type OffMirrorStatus,
} from "../lib/foodSources";
import { relativeTime } from "../lib/format";

const INTERVALS = ["off", "daily", "weekly", "monthly"] as const;

/** The server's own copy of Open Food Facts, when it keeps one */
export function OffMirror({ isOnly }: { isOnly: boolean }) {
  const { t, i18n } = useTranslation("settings");
  const isAdmin = useAdminBackends().includes("nt");
  const status = useLoad(
    () => api.nt.get<OffMirrorStatus>("/off-local/status"),
    [],
  );
  const { isBusy, run } = useAction();
  const data = status.data;
  const isDownloading = data?.refresh?.state === "downloading";
  const { reload } = status;

  useEffect(() => {
    const timer = setInterval(
      () => void reload(),
      isDownloading ? 2_000 : 30_000,
    );
    return () => {
      clearInterval(timer);
    };
  }, [isDownloading, reload]);

  return (
    <Section title={t("sources.mirror.title")}>
      <LoadState
        isLoading={status.isLoading}
        error={status.error}
        onRetry={() => void reload()}
        hasData={data !== null}
      >
        {data ? (
          <Stack gap={3}>
            <Row gap={2} shouldWrap>
              <Chip text={t(`sources.mirror.states.${offMirrorState(data)}`)} />
              {isOnly ? <Chip text={t("sources.mirror.airGap")} /> : null}
            </Row>
            {isDownloading ? (
              <ProgressBar
                value={data.refresh?.progress ?? 0}
                label={t("sources.mirror.states.downloading")}
              />
            ) : null}
            {data.size_bytes ? (
              <Text variant="small" tone="muted">
                {formatBytes(data.size_bytes)}
                {data.mtime_ms
                  ? ` · ${t("sources.mirror.updated", { when: relativeTime(data.mtime_ms, i18n.language) })}`
                  : ""}
              </Text>
            ) : null}
            {data.refresh?.last_error ? (
              <Text variant="small" tone="danger">
                {data.refresh.last_error}
              </Text>
            ) : null}
            {isAdmin ? (
              <>
                <Row>
                  <Button
                    variant="secondary"
                    size="sm"
                    text={t("sources.mirror.refresh")}
                    isDisabled={isDownloading}
                    isLoading={isBusy}
                    onClick={() =>
                      void run(async () => {
                        await api.nt.post("/off-local/refresh", {});
                        await reload();
                      })
                    }
                  />
                </Row>
                <SelectRow<string>
                  label={t("sources.mirror.auto")}
                  value={data.refresh_interval ?? "weekly"}
                  options={INTERVALS.map((value) => ({
                    value,
                    label: t(`sources.mirror.intervals.${value}`),
                  }))}
                  onChange={(interval) =>
                    void run(async () => {
                      await api.nt.put("/off-local/schedule", { interval });
                      await reload();
                    })
                  }
                />
                <Text variant="small" tone="muted">
                  {t("sources.mirror.shareAlike")}
                </Text>
                <ExternalLink
                  href="https://opendatacommons.org/licenses/odbl/1-0/"
                  text={t("sources.mirror.odbl")}
                />
                <ExternalLink
                  href="https://github.com/TraceApps/nutritrace/blob/main/LICENSES.md"
                  text={t("sources.mirror.licenses")}
                />
              </>
            ) : null}
          </Stack>
        ) : null}
      </LoadState>
    </Section>
  );
}
