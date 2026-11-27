import {
  Button,
  Dialog,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { isScan } from "../../lib/importing";
import { COOKBOOK_PROMPT, DOCUMENT_PROMPT, wrapText } from "../../lib/recipeAi";
import type { Recipe } from "../../recipesApi";

import { FilePick } from "./FilePick";
import { extractFile } from "./importApi";
import type { ImportDialogProps } from "./PasteImportDialog";
import { MAX_PDF_BYTES, useRecipeAi } from "./useRecipeAi";

type Phase =
  | { name: "pick" }
  | { name: "preparing" }
  | { name: "ready"; text: string | null; pages: number }
  | { name: "extracting"; saved: number }
  | { name: "done"; recipes: Recipe[]; isCutOff: boolean }
  | { name: "error"; message: string };

/** Every recipe of a cookbook PDF, read by the AI */
export function CookbookImportDialog({
  onClose,
  onImported,
}: ImportDialogProps) {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const ai = useRecipeAi();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const file = files[0] as File | undefined;
  const isWorking = phase.name === "preparing" || phase.name === "extracting";

  const fail = (caught: unknown) => {
    const message =
      caught instanceof Error ? caught.message : t("importers.failed");
    setPhase({
      name: "error",
      message:
        message === "missing-api-key" || message === "missing-base-url"
          ? t("importers.ai.notConfigured")
          : message,
    });
  };

  const prepare = async () => {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setPhase({ name: "error", message: t("importers.cookbook.pdfOnly") });
      return;
    }
    setPhase({ name: "preparing" });
    try {
      const data = await extractFile(file);
      const isImageOnly = isScan(data);
      if (isImageOnly && !ai.canReadPdf) {
        setPhase({
          name: "error",
          message: data.hint || t("importers.file.noText"),
        });
        return;
      }
      setPhase({
        name: "ready",
        text: isImageOnly ? null : data.text,
        pages: data.pages ?? 0,
      });
    } catch (caught) {
      fail(caught);
    }
  };

  const extract = async (text: string | null) => {
    if (!file) return;
    if (text === null && file.size > MAX_PDF_BYTES) {
      setPhase({ name: "error", message: t("importers.ai.tooLarge") });
      return;
    }
    setPhase({ name: "extracting", saved: 0 });
    let saved = 0;
    try {
      const result = await ai.extract(
        {
          systemPrompt: COOKBOOK_PROMPT,
          ...(text === null
            ? {
                prompt: DOCUMENT_PROMPT,
                image: await ai.readFile(file),
              }
            : { prompt: wrapText("COOKBOOK", text) }),
        },
        (count) => {
          saved = count;
          setPhase({ name: "extracting", saved: count });
        },
      );
      if (result.saved.length === 0) {
        setPhase({ name: "error", message: t("importers.cookbook.none") });
        return;
      }
      onImported();
      setPhase({
        name: "done",
        recipes: result.saved,
        isCutOff: result.isCutOff,
      });
    } catch (caught) {
      // Recipes saved before the failure stay.
      if (saved > 0) onImported();
      fail(caught);
    }
  };

  const confirm = !ai.isAvailable
    ? null
    : phase.name === "pick"
      ? {
          text: t("importers.source.next"),
          action: prepare,
          isDisabled: !file,
        }
      : phase.name === "ready"
        ? {
            text: t("importers.cookbook.extract"),
            action: () => extract(phase.text),
            isDisabled: false,
          }
        : null;

  const body = () => {
    if (!ai.isAvailable) {
      return (
        <Stack gap={2} align="center">
          {ai.isEnvLocked ? (
            <Lock aria-hidden size={28} />
          ) : (
            <Sparkles aria-hidden size={28} />
          )}
          <Text align="center">
            {ai.isEnvLocked
              ? t("importers.ai.envLocked")
              : t("importers.cookbook.needsAi")}
          </Text>
          {ai.isEnvLocked ? null : (
            <Link className="underline" to="/settings" onClick={onClose}>
              {t("importers.cookbook.settings")}
            </Link>
          )}
        </Stack>
      );
    }
    if (phase.name === "pick") {
      return (
        <FilePick
          isSingle
          files={files}
          onChange={setFiles}
          accept="application/pdf,.pdf"
          hint={t("importers.cookbook.pick")}
        />
      );
    }
    if (isWorking) {
      const label =
        phase.name === "extracting" && phase.saved > 0
          ? t("importers.cookbook.found", { count: phase.saved })
          : t("importers.ai.reading");
      return (
        <Stack align="center" gap={2} padding={4}>
          <Spinner size="lg" label={label} />
          <Text tone="muted">{label}</Text>
          <Text variant="caption" tone="muted">
            {t("importers.cookbook.keepOpen")}
          </Text>
        </Stack>
      );
    }
    if (phase.name === "ready") {
      return (
        <Text>
          {phase.text === null
            ? t("importers.cookbook.scanned", { count: phase.pages })
            : t("importers.cookbook.extracted", {
                size: (phase.text.length / 1024).toFixed(1),
                count: phase.pages,
              })}
        </Text>
      );
    }
    if (phase.name === "done") {
      return (
        <Stack gap={2}>
          <Text variant="heading">
            {t("importers.outcome.imported", {
              count: phase.recipes.length,
            })}
          </Text>
          {phase.isCutOff ? (
            <Text tone="warning">
              {t("importers.cookbook.cutOff", {
                count: phase.recipes.length,
              })}
            </Text>
          ) : null}
          {phase.recipes.map((recipe) => (
            <Button
              size="md"
              key={recipe.id}
              variant="ghost"
              text={recipe.name}
              onClick={() => {
                onClose();
                void navigate(`/cooking/recipes/${recipe.id}`);
              }}
            />
          ))}
        </Stack>
      );
    }
    return (
      <Text tone="danger" role="alert">
        {phase.message}
      </Text>
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !isWorking) onClose();
      }}
      title={t("importers.cookbook.title")}
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
      {body()}
    </Dialog>
  );
}
