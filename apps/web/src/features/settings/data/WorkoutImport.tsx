/** LiftTrace's workout import (SettingsWorkoutImport.svelte) */
import {
  Button,
  Dialog,
  Disclosure,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";

import { flushSettings } from "../common/binding";
import { SelectRow } from "../common/fields";
import { useAction } from "../common/useAction";
import { useUploadError } from "../common/useUploadError";
import { PickFile } from "./PickFile";

const SOURCES = ["strong", "hevy", "fitnotes", "jefit", "garmin-fit"] as const;
type Source = (typeof SOURCES)[number];

interface Preview {
  workouts: number;
  sets: number;
  uniqueExercises: number;
  matchedExercises: number;
  unmatchedExercises?: { name: string; count: number }[];
  duplicateDates: number;
  dateRange?: { from?: string; to?: string } | null;
}

interface Committed {
  imported: number;
  skipped: number;
  replaced: number;
}

export function WorkoutImport() {
  const { t } = useTranslation("settings");
  const [source, setSource] = useState<Source>("strong");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Committed | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const { isBusy, run } = useAction();
  const explain = useUploadError();

  const reset = () => {
    setFile(null);
    setPreview(null);
    setIsAsking(false);
  };
  const form = (chosen: File, extra: Record<string, string> = {}) => {
    const data = new FormData();
    data.append("file", chosen);
    data.append("source", source);
    for (const [key, value] of Object.entries(extra)) data.append(key, value);
    return data;
  };

  const pick = (chosen: File) => {
    reset();
    setResult(null);
    setFile(chosen);
    void run(async () => {
      // The server converts weights into the saved weight unit.
      await flushSettings("lt");
      setPreview(
        await explain(
          api.lt.post<Preview>("/workout-import/preview", form(chosen)),
        ),
      );
    });
  };

  const commit = (onDuplicate: "skip" | "replace") => {
    setIsAsking(false);
    if (!file) return;
    void run(async () => {
      setResult(
        await explain(
          api.lt.post<Committed>(
            "/workout-import/commit",
            form(file, { onDuplicate }),
          ),
        ),
      );
      reset();
    });
  };

  return (
    <Stack gap={3}>
      <SelectRow<Source>
        label={t("importExport.workouts.source")}
        hint={t(`importExport.workouts.instructions.${source}`)}
        value={source}
        options={SOURCES.map((value) => ({
          value,
          label: t(`importExport.workouts.sources.${value}`),
        }))}
        onChange={(next) => {
          setSource(next);
          setResult(null);
          reset();
        }}
      />
      <PickFile
        accept={source === "garmin-fit" ? ".fit" : ".csv"}
        text={t("importExport.chooseFile")}
        isDisabled={isBusy}
        onPick={pick}
      />
      {isBusy ? <Spinner label={t("loading")} /> : null}
      {preview ? (
        <Stack gap={2}>
          <Text role="status">
            {t("importExport.workouts.stats", {
              file: file?.name ?? "",
              workouts: preview.workouts,
              sets: preview.sets,
              exercises: preview.uniqueExercises,
              matched: preview.matchedExercises,
              from: preview.dateRange?.from ?? "?",
              to: preview.dateRange?.to ?? "?",
            })}
          </Text>
          {preview.duplicateDates > 0 ? (
            <Text variant="small" tone="warning">
              {t("importExport.workouts.duplicates", {
                count: preview.duplicateDates,
              })}
            </Text>
          ) : null}
          {preview.unmatchedExercises?.length ? (
            <Disclosure
              title={t("importExport.workouts.unmatched")}
              count={preview.unmatchedExercises.length}
            >
              {preview.unmatchedExercises.map((exercise) => (
                <Text key={exercise.name} variant="small">
                  {`${exercise.name} (${exercise.count})`}
                </Text>
              ))}
            </Disclosure>
          ) : null}
          <Row gap={2}>
            <Button
              variant="primary"
              size="md"
              text={t("actions.import")}
              isDisabled={isBusy}
              onClick={() => {
                if (preview.duplicateDates > 0) setIsAsking(true);
                else commit("skip");
              }}
            />
            <Button
              variant="ghost"
              size="md"
              text={t("actions.cancel")}
              onClick={reset}
            />
          </Row>
        </Stack>
      ) : null}
      {isAsking ? (
        // Closing the dialog cancels; the old UI imported anyway.
        <Dialog
          open
          title={t("importExport.workouts.askTitle")}
          description={t("importExport.workouts.askText", {
            count: preview?.duplicateDates ?? 0,
          })}
          cancelText={t("actions.cancel")}
          confirmText={t("importExport.workouts.skip")}
          onConfirm={() => {
            commit("skip");
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen) setIsAsking(false);
          }}
        >
          <Row>
            <Button
              variant="danger"
              size="md"
              text={t("importExport.workouts.replace")}
              onClick={() => {
                commit("replace");
              }}
            />
          </Row>
        </Dialog>
      ) : null}
      {result ? (
        <Text role="status" tone="success">
          {t("importExport.workouts.done", {
            imported: result.imported,
            skipped: result.skipped,
            replaced: result.replaced,
          })}
        </Text>
      ) : null}
    </Stack>
  );
}
