import {
  Dialog,
  Input,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";

import { FilePick } from "./FilePick";
import { DEFAULT_OPTIONS, importRecipe } from "./importApi";
import { ImportOptionsFields } from "./ImportOptionsFields";
import { useImportOutcome } from "./useImportOutcome";

export interface ImportDialogProps {
  onClose: () => void;
  onImported: () => void;
}

/** Pasted JSON or HTML, or a file of either (Paprika archives too) */
export function PasteImportDialog({ onClose, onImported }: ImportDialogProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const outcome = useImportOutcome(onImported);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [isBusy, setIsBusy] = useState(false);
  const file = files[0] as File | undefined;

  const run = async () => {
    setIsBusy(true);
    try {
      const answer = await importRecipe(file ? { file } : { text }, options);
      onClose();
      outcome(answer);
    } catch (caught) {
      notify.failure(caught, t("importers.failed"));
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
      title={t("importers.paste.title")}
      cancelText={t("cookingCommon.cancel")}
      confirmText={t("importers.import")}
      onConfirm={run}
      isBusy={isBusy}
      isConfirmDisabled={!file && !text.trim()}
    >
      <Stack gap={4}>
        <Input
          multiline
          rows={8}
          label={t("importers.paste.text")}
          placeholder={t("importers.paste.placeholder")}
          value={text}
          disabled={Boolean(file)}
          onValueChange={setText}
        />
        <Text variant="caption" tone="muted" align="center">
          {t("importers.paste.or")}
        </Text>
        <FilePick
          isSingle
          files={files}
          onChange={(next) => {
            setFiles(next);
            if (next.length > 0) setText("");
          }}
          accept=".json,.html,.htm,.paprikarecipes,.paprikarecipe,application/json,text/html"
          hint={t("importers.paste.fileHint")}
        />
        <ImportOptionsFields
          options={options}
          onChange={setOptions}
          isDisabled={isBusy}
        />
      </Stack>
    </Dialog>
  );
}
