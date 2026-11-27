import {
  Button,
  Chip,
  EmptyState,
  KeyValue,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, apiPath, type BackendId } from "@/api";
import { settingsStores } from "@/features/shared/settings";

import { useAdminBackends } from "../common/admin";
import { AppSwitch } from "../common/AppSwitch";
import { NumberRow, SelectRow, TextRow } from "../common/fields";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useAppParam } from "../common/useAppParam";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { useUploadError } from "../common/useUploadError";
import { useWakeLock } from "../common/useWakeLock";
import {
  LIFT_RESET_VALUES,
  nextBackupAt,
  type BackupFile,
  type BackupSchedule,
} from "../lib/backup";
import { downloadUrl } from "../lib/download";
import { formatBytes } from "../lib/foodSources";
import { formatDateTime, relativeTime } from "../lib/format";
import { SETUP_COMPLETE_KEY } from "../lib/onboarding";
import { PickFile } from "./PickFile";

/** Reload so every screen reads the restored or cleared data */
function reloadApp(): void {
  setTimeout(() => {
    window.location.reload();
  }, 1200);
}

function Schedule({ backend }: { backend: BackendId }) {
  const { t, i18n } = useTranslation("settings");
  const config = useLoad(
    () => api[backend].get<BackupSchedule>("/full-backup/schedule"),
    [backend],
  );
  const { run } = useAction();
  const data = config.data;
  const save = (patch: Partial<BackupSchedule>) =>
    run(async () => {
      try {
        await api[backend].put("/full-backup/schedule", patch);
      } finally {
        await config.reload();
      }
    });
  const next = data ? nextBackupAt(data) : null;

  return (
    <Section title={t("backup.auto")}>
      <LoadState
        isLoading={config.isLoading}
        error={config.error}
        onRetry={() => void config.reload()}
        hasData={data !== null}
      >
        {data ? (
          <Stack gap={3}>
            {data.envLocked ? (
              <Row>
                <Chip text={t("backup.envLocked")} />
              </Row>
            ) : null}
            <SelectRow<BackupSchedule["schedule"]>
              label={t("backup.schedule")}
              value={data.schedule}
              isDisabled={data.envLocked}
              options={(["off", "daily", "weekly", "monthly"] as const).map(
                (value) => ({ value, label: t(`backup.schedules.${value}`) }),
              )}
              onChange={(schedule) => void save({ schedule })}
            />
            {data.schedule !== "off" ? (
              <>
                <TextRow
                  type="time"
                  label={t("backup.time")}
                  value={data.time}
                  isDisabled={data.envLocked}
                  onCommit={(time) => void save({ time })}
                />
                <NumberRow
                  label={t("backup.retention")}
                  hint={t("backup.retentionHint", { count: data.retention })}
                  value={data.retention}
                  min={1}
                  max={99}
                  isInteger
                  isDisabled={data.envLocked}
                  onCommit={(retention) => void save({ retention })}
                />
              </>
            ) : null}
            {data.lastAutoError ? (
              <Text variant="small" tone="danger">
                {t("backup.lastError", { message: data.lastAutoError })}
              </Text>
            ) : null}
            {data.lastAutoRun ? (
              <Text variant="small" tone="muted">
                {t("backup.lastRun", {
                  when: relativeTime(data.lastAutoRun, i18n.language),
                })}
              </Text>
            ) : null}
            {next ? (
              <Text variant="small" tone="muted">
                {t("backup.nextRun", {
                  when: formatDateTime(next, i18n.language),
                })}
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </LoadState>
    </Section>
  );
}

function ServerBackups({ backend }: { backend: BackendId }) {
  const { t, i18n } = useTranslation("settings");
  const backups = useLoad(
    () => api[backend].get<BackupFile[]>("/full-backup"),
    [backend],
  );
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();
  const explain = useUploadError();
  const [isRestoring, setIsRestoring] = useState(false);
  useWakeLock(isRestoring);
  const path = (name: string) => `/full-backup/${encodeURIComponent(name)}`;

  const restore = async (name: string, action: () => Promise<unknown>) => {
    const isConfirmed = await confirm({
      title: t("backup.restoreTitle"),
      message: t("backup.restoreText", { name }),
      confirmText: t("backup.restore"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    setIsRestoring(true);
    const isDone = await run(action, { success: t("backup.restored") });
    setIsRestoring(false);
    if (isDone) reloadApp();
  };

  return (
    <Section title={t("backup.files")} hint={t("backup.filesHint")}>
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("backup.create")}
          isLoading={isBusy && !isRestoring}
          isDisabled={isBusy}
          onClick={() =>
            void run(
              async () => {
                await api[backend].post("/full-backup", {});
                await backups.reload();
              },
              { success: t("backup.created") },
            )
          }
        />
      </Row>
      <LoadState
        isLoading={backups.isLoading}
        error={backups.error}
        onRetry={() => void backups.reload()}
        hasData={backups.data !== null}
      >
        {backups.data?.length === 0 ? (
          <EmptyState text={t("backup.none")} />
        ) : null}
        {backups.data?.map((file) => (
          <Stack key={file.filename} gap={1}>
            <KeyValue
              layout="stacked"
              label={file.filename}
              value={`${formatBytes(file.size)} · ${formatDateTime(file.createdAt, i18n.language)}`}
            />
            <Row gap={2} shouldWrap>
              <Button
                variant="ghost"
                size="sm"
                text={t("actions.download")}
                aria-label={`${t("actions.download")}: ${file.filename}`}
                onClick={() => {
                  downloadUrl(
                    apiPath(backend, `${path(file.filename)}/download`),
                    file.filename,
                  );
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                text={t("backup.restore")}
                aria-label={`${t("backup.restore")}: ${file.filename}`}
                isDisabled={isBusy}
                onClick={() =>
                  void restore(file.filename, () =>
                    api[backend].post(`${path(file.filename)}/restore`, {}),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                text={t("actions.delete")}
                aria-label={`${t("actions.delete")}: ${file.filename}`}
                isDisabled={isBusy}
                onClick={() =>
                  void confirm({
                    title: t("backup.deleteTitle"),
                    message: file.filename,
                    confirmText: t("actions.delete"),
                    isDangerous: true,
                  }).then((isConfirmed) => {
                    if (!isConfirmed) return;
                    void run(async () => {
                      await api[backend].delete(path(file.filename));
                      await backups.reload();
                    });
                  })
                }
              />
            </Row>
          </Stack>
        ))}
      </LoadState>
      <PickFile
        accept=".zip"
        text={t("backup.upload")}
        isDisabled={isBusy}
        onPick={(file) =>
          void restore(file.name, () => {
            const form = new FormData();
            form.append("backup", file);
            return explain(
              api[backend].post("/full-backup/upload-restore", form),
            );
          })
        }
      />
      {isRestoring ? <Spinner label={t("backup.restoring")} /> : null}
      {dialog}
    </Section>
  );
}

function DangerZone({ backend }: { backend: BackendId }) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();
  const app = tCommon(`backends.${backend}`);

  const danger = async (
    title: string,
    message: string,
    action: () => Promise<unknown>,
  ) => {
    const isConfirmed = await confirm({
      title,
      message,
      confirmText: title,
      isDangerous: true,
    });
    if (!isConfirmed) return;
    if (await run(action)) reloadApp();
  };

  const clearSettings = async () => {
    const store = settingsStores[backend];
    await store.flush();
    if (backend === "lt") {
      await settingsStores.lt.setMany({ ...LIFT_RESET_VALUES });
    } else {
      await api[backend].delete("/settings");
    }
    if (backend === "nt") {
      // The setup stays done: without this row the assistant would reopen.
      await api.nt.put("/settings", { key: SETUP_COMPLETE_KEY, value: true });
    }
    try {
      const prefix = `trace.settings.${backend}.`;
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    } catch {
      // Blocked storage holds nothing to clear.
    }
  };

  return (
    <Section title={t("backup.danger")}>
      <Row gap={2} shouldWrap>
        <Button
          variant="danger"
          size="md"
          text={t(
            backend === "lt" ? "backup.clearWorkouts" : "backup.clearData",
          )}
          isDisabled={isBusy}
          onClick={() =>
            void danger(
              t(backend === "lt" ? "backup.clearWorkouts" : "backup.clearData"),
              t(`backup.clearDataText.${backend}`),
              () =>
                api[backend].delete(
                  backend === "lt" ? "/settings/clear-data" : "/data",
                ),
            )
          }
        />
        <Button
          variant="danger"
          size="md"
          text={t("backup.clearSettings")}
          isDisabled={isBusy}
          onClick={() =>
            void danger(
              t("backup.clearSettings"),
              t(
                backend === "lt"
                  ? "backup.clearSettingsLift"
                  : "backup.clearSettingsText",
                { app },
              ),
              clearSettings,
            )
          }
        />
      </Row>
      {dialog}
    </Section>
  );
}

export function BackupPage() {
  const { t } = useTranslation("settings");
  const [backend, setBackend] = useAppParam();
  const isAdmin = useAdminBackends().includes(backend);
  return (
    <SettingsScreen
      title={t("topics.backup.title")}
      description={t("backup.description")}
    >
      <AppSwitch value={backend} onChange={setBackend} />
      <Stack gap={6} key={backend}>
        {isAdmin ? (
          <>
            <Schedule backend={backend} />
            <ServerBackups backend={backend} />
          </>
        ) : (
          <Text tone="muted">{t("adminOnly")}</Text>
        )}
        {backend === "ct" ? (
          <Section
            title={t("backup.jsonExport")}
            hint={t("backup.jsonExportHint")}
          >
            <Row>
              <Button
                variant="secondary"
                size="md"
                text={t("importExport.exports.json")}
                onClick={() => {
                  downloadUrl(
                    apiPath("ct", "/data/export"),
                    "cooktrace-export.json",
                  );
                }}
              />
            </Row>
          </Section>
        ) : null}
        <DangerZone backend={backend} />
      </Stack>
    </SettingsScreen>
  );
}
