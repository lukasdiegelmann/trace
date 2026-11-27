import {
  Button,
  Chip,
  FileInput,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { droppedFiles } from "./droppedFiles";

export interface FilePickProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept: string;
  hint: string;
  hasCamera?: boolean;
  isSingle?: boolean;
}

/**
 * Picks files one by one, or several (folders too) by dropping them.
 * TODO(monolithium): FileInput with `multiple`, folder picking and a drop
 * zone.
 */
export function FilePick({
  files,
  onChange,
  accept,
  hint,
  hasCamera,
  isSingle,
}: FilePickProps) {
  const { t } = useTranslation("cooking");
  const [isOver, setIsOver] = useState(false);
  const add = (next: File[]) => {
    if (next.length === 0) return;
    onChange(isSingle ? next.slice(0, 1) : [...files, ...next]);
  };

  return (
    <Stack gap={2}>
      <div
        className={`flex flex-col items-center gap-2 rounded-container border border-dashed p-4 text-center ${
          isOver ? "border-accent bg-accent/10" : "border-border"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => {
          setIsOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          void droppedFiles(event.dataTransfer).then(add);
        }}
      >
        <Text variant="small" tone="muted">
          {hint}
        </Text>
        <FileInput
          accept={accept}
          capture={hasCamera ? "environment" : undefined}
          captureText={hasCamera ? t("cookingCommon.photo.camera") : undefined}
          text={t("cookingCommon.photo.choose")}
          placeholder={t("cookingCommon.photo.noFile")}
          file={null}
          onChange={(file) => {
            if (file) add([file]);
          }}
        />
      </div>
      {files.length > 0 ? (
        <Stack gap={1} as="ul">
          {files.map((file, index) => (
            <li key={`${index}-${file.name}`}>
              <Row gap={2} align="center">
                <Chip
                  text={`${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("importers.removeFile", { name: file.name })}
                  onClick={() => {
                    onChange(files.filter((_, i) => i !== index));
                  }}
                >
                  <X aria-hidden size={14} />
                </Button>
              </Row>
            </li>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
