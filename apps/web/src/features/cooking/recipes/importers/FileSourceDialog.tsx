import { Dialog, Stack, Text } from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";
import { routeFiles } from "../../lib/importing";

import { BulkImportDialog } from "./BulkImportDialog";
import { FileImportDialog } from "./FileImportDialog";
import { FilePick } from "./FilePick";
import type { ImportDialogProps } from "./PasteImportDialog";

const ACCEPT =
  "image/*,.pdf,.rtf,.txt,.md,.markdown,.zip,application/pdf,application/rtf,text/rtf,text/plain,text/markdown,application/zip,application/x-zip-compressed";

/** "From a file": one file goes alone, a ZIP or several go in bulk */
export function FileSourceDialog({ onClose, onImported }: ImportDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [files, setFiles] = useState<File[]>([]);
  const [chosen, setChosen] = useState<"single" | "bulk" | null>(null);

  if (chosen === "single") {
    return (
      <FileImportDialog
        file={files[0]}
        onClose={onClose}
        onImported={onImported}
      />
    );
  }
  if (chosen === "bulk") {
    return (
      <BulkImportDialog
        files={files}
        onClose={onClose}
        onImported={onImported}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("importers.source.title")}
      cancelText={t("cookingCommon.cancel")}
      confirmText={t("importers.source.next")}
      isConfirmDisabled={files.length === 0}
      onConfirm={() => {
        const route = routeFiles(files);
        if (route === "unsupported") {
          notify.error(t("importers.source.unsupported"));
        } else if (route !== "none") setChosen(route);
      }}
    >
      <Stack gap={3}>
        <Text variant="small" tone="muted">
          {t("importers.source.hint")}
        </Text>
        <FilePick
          hasCamera
          files={files}
          onChange={setFiles}
          accept={ACCEPT}
          hint={t("importers.source.drop")}
        />
      </Stack>
    </Dialog>
  );
}
