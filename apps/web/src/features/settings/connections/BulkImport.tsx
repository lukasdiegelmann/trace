import {
  Button,
  ProgressBar,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import type { BulkCount } from "../lib/cooktraceImport";

export interface BulkImportProps {
  label: string;
  confirmText: string;
  /** Runs the import, reporting how far it is */
  run: (
    onProgress: (done: number, total: number) => void,
  ) => Promise<BulkCount>;
}

/** One "import everything" job: ask, show progress, then what happened */
export function BulkImport({ label, confirmText, run }: BulkImportProps) {
  const { t } = useTranslation("settings");
  const { confirm, dialog } = useConfirm();
  const action = useAction();
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BulkCount | null>(null);

  const start = async () => {
    const isConfirmed = await confirm({
      title: label,
      message: confirmText,
      confirmText: t("actions.import"),
    });
    if (!isConfirmed) return;
    setResult(null);
    setProgress({ done: 0, total: 0 });
    await action.run(async () => {
      setResult(
        await run((done, total) => {
          setProgress({ done, total });
        }),
      );
    });
  };

  return (
    <Stack gap={2}>
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={label}
          isLoading={action.isBusy}
          onClick={() => void start()}
        />
      </Row>
      {action.isBusy && progress.total > 0 ? (
        <ProgressBar
          value={progress.done / progress.total}
          label={t("connections.progress", progress)}
        />
      ) : null}
      {result ? (
        <Stack gap={1} role="status">
          <Text variant="small">
            {t("connections.result", {
              imported: result.imported,
              updated: result.updated,
              skipped: result.skipped,
            })}
          </Text>
          {result.collided > 0 ? (
            <Text variant="small" tone="muted">
              {t("connections.collided", { count: result.collided })}
            </Text>
          ) : null}
          {result.firstError ? (
            <Text variant="small" tone="danger">
              {t("connections.firstError", { message: result.firstError })}
            </Text>
          ) : null}
        </Stack>
      ) : null}
      {dialog}
    </Stack>
  );
}
