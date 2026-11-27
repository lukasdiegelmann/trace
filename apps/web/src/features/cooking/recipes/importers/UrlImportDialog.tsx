import {
  Dialog,
  Input,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";
import { MAX_BATCH_URLS, parseUrlList } from "../../lib/importing";

import { BatchPicker } from "./BatchPicker";
import {
  commitBatch,
  DEFAULT_OPTIONS,
  scrapeBatch,
  scrapeRecipe,
  type CommitResult,
} from "./importApi";
import { ImportOptionsFields } from "./ImportOptionsFields";
import type { ImportDialogProps } from "./PasteImportDialog";
import { useBatch } from "./useBatch";
import { useImportOutcome } from "./useImportOutcome";

type Phase =
  | { name: "input" }
  | { name: "busy" }
  | { name: "scanned" }
  | { name: "saving" }
  | { name: "done"; result: CommitResult }
  | { name: "error"; message: string };

/** One link is saved at once; several are scraped, then picked from */
export function UrlImportDialog({ onClose, onImported }: ImportDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const outcome = useImportOutcome(onImported);
  const [phase, setPhase] = useState<Phase>({ name: "input" });
  const [text, setText] = useState("");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const { batch, selected, setSelected, start, settle, drop } = useBatch();
  const urls = parseUrlList(text);
  const isWorking = phase.name === "busy" || phase.name === "saving";

  const fail = (caught: unknown) => {
    setPhase({
      name: "error",
      message: caught instanceof Error ? caught.message : t("importers.failed"),
    });
  };

  const scrape = async () => {
    if (urls.length > MAX_BATCH_URLS) {
      notify.error(t("importers.url.limit", { max: MAX_BATCH_URLS }));
      return;
    }
    setPhase({ name: "busy" });
    try {
      if (urls.length === 1) {
        const answer = await scrapeRecipe(urls[0], options);
        onClose();
        outcome(answer);
        return;
      }
      const next = await scrapeBatch(urls);
      start(
        next,
        next.items.filter((item) => !item.error).map((item) => item.id),
      );
      setPhase({ name: "scanned" });
    } catch (caught) {
      fail(caught);
    }
  };

  const commit = async () => {
    if (!batch) return;
    setPhase({ name: "saving" });
    try {
      const result = await commitBatch(batch.cacheUuid, [...selected], options);
      settle();
      if (result.count > 0) {
        notify.success(
          t("importers.outcome.imported", { count: result.count }),
        );
        onImported();
      }
      setPhase({ name: "done", result });
    } catch (caught) {
      fail(caught);
    }
  };

  const confirm =
    phase.name === "input"
      ? {
          text:
            urls.length > 1
              ? t("importers.url.scrapeMany", { count: urls.length })
              : t("importers.import"),
          action: scrape,
          isDisabled: urls.length === 0,
        }
      : phase.name === "scanned"
        ? {
            text: t("importers.batch.save", { count: selected.size }),
            action: commit,
            isDisabled: selected.size === 0,
          }
        : phase.name === "error"
          ? {
              text: t("cookingCommon.retry"),
              action: () => {
                drop();
                setPhase({ name: "input" });
              },
              isDisabled: false,
            }
          : null;

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(isOpen) => {
        if (!isOpen && !isWorking) onClose();
      }}
      title={t("importers.url.title")}
      cancelText={
        phase.name === "done"
          ? t("cookingCommon.close")
          : t("cookingCommon.cancel")
      }
      confirmText={confirm?.text}
      onConfirm={confirm?.action}
      isConfirmDisabled={confirm?.isDisabled}
      isBusy={isWorking}
    >
      {phase.name === "input" ? (
        <Stack gap={3}>
          <Input
            multiline
            rows={5}
            label={t("importers.url.label")}
            placeholder="https://"
            value={text}
            onValueChange={setText}
          />
          <Text variant="caption" tone="muted">
            {urls.length === 0
              ? t("importers.url.none")
              : t("importers.url.detected", { count: urls.length })}
          </Text>
          <ImportOptionsFields options={options} onChange={setOptions} />
        </Stack>
      ) : isWorking ? (
        <Stack align="center" gap={2} padding={4}>
          <Spinner size="lg" label={t("importers.working")} />
          <Text tone="muted">{t("importers.working")}</Text>
        </Stack>
      ) : phase.name === "scanned" && batch ? (
        <BatchPicker
          isScraped
          batch={batch}
          selected={selected}
          onChange={setSelected}
        />
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

export function BatchDone({ result }: { result: CommitResult }) {
  const { t } = useTranslation("cooking");
  return (
    <Stack gap={2}>
      <Text variant="heading">
        {t("importers.outcome.imported", { count: result.count })}
      </Text>
      <Text tone="muted">
        {result.failed.length > 0
          ? t("importers.batch.notSaved", { count: result.failed.length })
          : t("importers.batch.allSaved")}
      </Text>
      {result.failed.map((failure) => (
        <Text variant="small" tone="danger" key={failure.id}>
          {failure.reason}
        </Text>
      ))}
    </Stack>
  );
}
