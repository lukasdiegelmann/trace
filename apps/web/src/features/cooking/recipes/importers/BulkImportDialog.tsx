import {
  Dialog,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";
import { isSelectable } from "../../lib/importing";
import { wrapText } from "../../lib/recipeAi";

import { BatchPicker } from "./BatchPicker";
import {
  commitBatch,
  DEFAULT_OPTIONS,
  getBatchText,
  scanFiles,
  type BatchItem,
  type CommitResult,
} from "./importApi";
import { ImportOptionsFields } from "./ImportOptionsFields";
import type { ImportDialogProps } from "./PasteImportDialog";
import { BatchDone } from "./UrlImportDialog";
import { useBatch } from "./useBatch";
import { useRecipeAi } from "./useRecipeAi";

type Phase =
  | { name: "uploading" }
  | { name: "scanned" }
  | { name: "saving" }
  | { name: "done"; result: CommitResult }
  | { name: "error"; message: string };

export interface BulkImportDialogProps extends ImportDialogProps {
  files: File[];
}

/** Many files or a ZIP: scanned, picked from, then saved */
export function BulkImportDialog({
  files,
  onClose,
  onImported,
}: BulkImportDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const ai = useRecipeAi();
  const [phase, setPhase] = useState<Phase>({ name: "uploading" });
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const { batch, selected, setSelected, start, settle, drop } = useBatch();
  const [savedByAi, setSavedByAi] = useState(new Map<string, string>());
  const [isAiBusy, setIsAiBusy] = useState(false);
  const isWorking = phase.name === "uploading" || phase.name === "saving";

  useEffect(() => {
    let isCurrent = true;
    scanFiles(files).then(
      (next) => {
        if (!isCurrent) return;
        start(
          next,
          next.items
            .filter(
              (item) =>
                isSelectable(item) &&
                item.confidence >= next.highConfidenceThreshold,
            )
            .map((item) => item.id),
        );
        setPhase({ name: "scanned" });
      },
      (caught: unknown) => {
        if (!isCurrent) return;
        setPhase({
          name: "error",
          message:
            caught instanceof Error ? caught.message : t("importers.failed"),
        });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [files, start, t]);

  const tryAi = async (item: BatchItem) => {
    if (!batch) return;
    setIsAiBusy(true);
    try {
      const { text } = await getBatchText(batch.cacheUuid, item.id);
      const { saved } = await ai.extract({
        prompt: wrapText("RECIPE", text),
      });
      if (saved.length === 0) {
        notify.error(t("importers.ai.nothing"));
      } else {
        const name = saved[0].name;
        setSavedByAi((previous) => new Map(previous).set(item.id, name));
        const next = new Set(selected);
        next.delete(item.id);
        setSelected(next);
        notify.success(t("importers.ai.saved", { name }));
        onImported();
      }
    } catch (caught) {
      notify.failure(caught, t("importers.failed"));
    }
    setIsAiBusy(false);
  };

  const commit = async () => {
    if (!batch) return;
    setPhase({ name: "saving" });
    try {
      const result = await commitBatch(batch.cacheUuid, [...selected], options);
      settle();
      if (result.count > 0) onImported();
      setPhase({ name: "done", result });
    } catch (caught) {
      drop();
      setPhase({
        name: "error",
        message:
          caught instanceof Error ? caught.message : t("importers.failed"),
      });
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(isOpen) => {
        if (!isOpen && !isWorking && !isAiBusy) onClose();
      }}
      title={t("importers.bulk.title")}
      cancelText={
        phase.name === "done"
          ? t("cookingCommon.close")
          : t("cookingCommon.cancel")
      }
      confirmText={t("importers.batch.save", { count: selected.size })}
      onConfirm={phase.name === "scanned" ? commit : undefined}
      isConfirmDisabled={selected.size === 0 || isAiBusy}
      isBusy={isWorking || isAiBusy}
    >
      {isWorking ? (
        <Stack align="center" gap={2} padding={4}>
          <Spinner size="lg" label={t("importers.working")} />
          <Text tone="muted">{t("importers.working")}</Text>
        </Stack>
      ) : phase.name === "scanned" && batch ? (
        <Stack gap={4}>
          <BatchPicker
            batch={batch}
            selected={selected}
            onChange={setSelected}
            savedByAi={savedByAi}
            onTryAi={ai.isAvailable ? (item) => void tryAi(item) : undefined}
            isAiBusy={isAiBusy}
          />
          <ImportOptionsFields options={options} onChange={setOptions} />
        </Stack>
      ) : phase.name === "done" ? (
        <BatchDone result={phase.result} />
      ) : phase.name === "error" ? (
        <Text tone="danger" role="alert">
          {phase.message}
        </Text>
      ) : null}
    </Dialog>
  );
}
