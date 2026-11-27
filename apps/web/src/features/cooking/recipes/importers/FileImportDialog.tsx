import {
  Button,
  Chip,
  Dialog,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { formatDuration } from "../../lib/duration";
import { confidenceOf, fileKind, isScan } from "../../lib/importing";
import { DOCUMENT_PROMPT, PHOTO_PROMPT, wrapText } from "../../lib/recipeAi";

import {
  DEFAULT_OPTIONS,
  extractFile,
  saveExtraction,
  type Extraction,
} from "./importApi";
import { ImportOptionsFields } from "./ImportOptionsFields";
import type { ImportDialogProps } from "./PasteImportDialog";
import { MAX_PDF_BYTES, useRecipeAi } from "./useRecipeAi";

const HIGH_CONFIDENCE = 0.7;

type Phase =
  | { name: "photo" }
  | { name: "busy"; text: string }
  | { name: "review"; data: Extraction }
  | { name: "scanned"; data: Extraction }
  | { name: "done"; id: number; title: string }
  | { name: "error"; message: string };

function usePreview(url: File | null): string {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!url) return;
    const next = URL.createObjectURL(url);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an object URL needs an effect
    setPreview(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [url]);
  return preview;
}

export interface FileImportDialogProps extends ImportDialogProps {
  file: File;
}

/**
 * One recipe from one file: text files are parsed by the server (the AI
 * can try again), photos and scanned PDFs are read by the AI.
 */
export function FileImportDialog({
  file,
  onClose,
  onImported,
}: FileImportDialogProps) {
  const { t } = useTranslation("cooking");
  const navigate = useNavigate();
  const ai = useRecipeAi();
  const isPhoto = fileKind(file) === "image";
  const preview = usePreview(isPhoto ? file : null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [phase, setPhase] = useState<Phase>(
    isPhoto
      ? { name: "photo" }
      : { name: "busy", text: t("importers.file.reading") },
  );

  const fail = useCallback(
    (caught: unknown) => {
      const message =
        caught instanceof Error ? caught.message : t("importers.failed");
      setPhase({
        name: "error",
        message:
          message === "missing-api-key" || message === "missing-base-url"
            ? t("importers.ai.notConfigured")
            : message,
      });
    },
    [t],
  );

  useEffect(() => {
    if (isPhoto) return;
    let isCurrent = true;
    extractFile(file).then(
      (data) => {
        if (!isCurrent) return;
        setPhase(
          isScan(data) ? { name: "scanned", data } : { name: "review", data },
        );
      },
      (caught: unknown) => {
        if (isCurrent) fail(caught);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [file, isPhoto, fail]);

  const readWithAi = async (
    build: () => Promise<Parameters<typeof ai.extract>[0]>,
  ) => {
    setPhase({ name: "busy", text: t("importers.ai.reading") });
    try {
      const { saved } = await ai.extract(await build());
      if (saved.length === 0) {
        setPhase({ name: "error", message: t("importers.ai.nothing") });
        return;
      }
      onImported();
      setPhase({ name: "done", id: saved[0].id, title: saved[0].name });
    } catch (caught) {
      fail(caught);
    }
  };

  const readDocument = () => {
    if (file.size > MAX_PDF_BYTES) {
      setPhase({ name: "error", message: t("importers.ai.tooLarge") });
      return;
    }
    void readWithAi(async () => ({
      prompt: DOCUMENT_PROMPT,
      image: await ai.readFile(file),
    }));
  };

  const saveParsed = async () => {
    setPhase({ name: "busy", text: t("importers.file.saving") });
    try {
      const { recipe } = await saveExtraction(file, options);
      if (!recipe) {
        setPhase({
          name: "error",
          message: t("importers.outcome.duplicate"),
        });
        return;
      }
      onImported();
      setPhase({ name: "done", id: recipe.id, title: recipe.name });
    } catch (caught) {
      fail(caught);
    }
  };

  const threshold =
    (phase.name === "review"
      ? phase.data.highConfidenceThreshold
      : undefined) ?? HIGH_CONFIDENCE;
  const isLow = phase.name === "review" && phase.data.confidence < threshold;

  const confirm =
    phase.name === "photo"
      ? {
          text: t("importers.import"),
          action: () => {
            void readWithAi(async () => ({
              prompt: PHOTO_PROMPT,
              image: await ai.readFile(file),
            }));
          },
          isDisabled: !ai.isAvailable,
        }
      : phase.name === "review"
        ? {
            text: isLow
              ? t("importers.file.saveAnyway")
              : t("importers.file.save"),
            action: () => void saveParsed(),
            isDisabled: false,
          }
        : phase.name === "done"
          ? {
              text: t("importers.file.open"),
              action: () => {
                onClose();
                void navigate(`/cooking/recipes/${phase.id}`);
              },
              isDisabled: false,
            }
          : null;

  const aiHint = ai.isEnvLocked
    ? t("importers.ai.envLocked")
    : ai.isEnabled
      ? null
      : t("importers.ai.disabled");

  const body = () => {
    if (phase.name === "photo") {
      return (
        <Stack gap={3}>
          <img
            src={preview}
            alt={file.name}
            className="max-h-80 w-full rounded-container object-contain"
          />
          <Text variant="small" tone="muted">
            {aiHint ?? t("importers.file.photoHint")}
          </Text>
        </Stack>
      );
    }
    if (phase.name === "busy") {
      return (
        <Stack align="center" gap={2} padding={4}>
          <Spinner size="lg" label={phase.text} />
          <Text tone="muted">{phase.text}</Text>
        </Stack>
      );
    }
    if (phase.name === "scanned") {
      const isPdfForAi =
        phase.data.type === "pdf" && ai.isAvailable && ai.canReadPdf;
      return (
        <Stack gap={3}>
          <Text>{phase.data.hint || t("importers.file.noText")}</Text>
          {isPdfForAi ? (
            <Button
              size="md"
              variant="primary"
              text={t("importers.ai.readDocument")}
              onClick={readDocument}
            >
              <Sparkles aria-hidden size={16} />
            </Button>
          ) : null}
        </Stack>
      );
    }
    if (phase.name === "review") {
      const { data } = phase;
      const recipe = data.recipe ?? {};
      const grade = confidenceOf(data.confidence, threshold);
      const facts = [
        recipe.servings
          ? t("recipeCommon.card.serves", { count: recipe.servings })
          : null,
        recipe.prep_minutes
          ? `${t("recipeView.prep")} ${formatDuration(recipe.prep_minutes)}`
          : null,
        recipe.cook_minutes
          ? `${t("recipeView.cook")} ${formatDuration(recipe.cook_minutes)}`
          : null,
        recipe.rest_minutes
          ? `${t("recipeView.rest")} ${formatDuration(recipe.rest_minutes)}`
          : null,
      ].filter(Boolean);
      const ingredientCount = (recipe.ingredients ?? []).reduce(
        (sum, group) => sum + (group.items?.length ?? 0),
        0,
      );
      return (
        <Stack gap={3}>
          <Chip
            className="self-start"
            tone={grade === "clean" ? "accent" : "default"}
            text={`${t(`importers.confidence.${grade}`)} · ${Math.round(data.confidence * 100)}%`}
          />
          {data.pages ? (
            <Text variant="caption" tone="muted">
              {t("importers.file.pages", { count: data.pages })}
            </Text>
          ) : null}
          <Text variant="heading">
            {recipe.name || t("importers.untitled")}
          </Text>
          {facts.length > 0 ? <Text>{facts.join(" · ")}</Text> : null}
          <Text tone="muted">
            {t("importers.batch.counts", {
              ingredients: ingredientCount,
              steps: recipe.steps?.length ?? 0,
            })}
          </Text>
          {isLow ? (
            <Text variant="small" tone="muted">
              {t("importers.file.lowHint")} {aiHint}
            </Text>
          ) : null}
          {isLow && ai.isAvailable ? (
            <Button
              size="md"
              variant="secondary"
              text={t("importers.tryAi")}
              onClick={() => {
                void readWithAi(() =>
                  Promise.resolve({
                    prompt: wrapText("RECIPE", data.text),
                  }),
                );
              }}
            >
              <Sparkles aria-hidden size={16} />
            </Button>
          ) : null}
          <ImportOptionsFields options={options} onChange={setOptions} />
        </Stack>
      );
    }
    if (phase.name === "done") {
      return (
        <Text variant="heading">
          {t("importers.file.imported", { name: phase.title })}
        </Text>
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
        if (!isOpen && phase.name !== "busy") onClose();
      }}
      title={t("importers.file.title")}
      description={file.name}
      cancelText={
        phase.name === "done"
          ? t("cookingCommon.done")
          : t("cookingCommon.cancel")
      }
      confirmText={confirm?.text}
      onConfirm={confirm?.action}
      isConfirmDisabled={confirm?.isDisabled}
      isBusy={phase.name === "busy"}
    >
      {body()}
    </Dialog>
  );
}
