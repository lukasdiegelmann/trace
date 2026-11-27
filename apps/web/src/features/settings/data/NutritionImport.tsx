/** Import from another nutrition app (SettingsNutritionImport.svelte) */
import {
  Button,
  ExternalLink,
  FileInput,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";

import { useShared } from "../common/binding";
import { SegmentRow, SelectRow } from "../common/fields";
import { useAction } from "../common/useAction";
import { useUploadError } from "../common/useUploadError";

const SOURCES = ["spreadsheet", "cronometer", "loseit", "mfp"] as const;
type Source = (typeof SOURCES)[number];
type OnDuplicate = "skip" | "merge" | "replace";

interface Preview {
  items: number;
  days: number;
  dateRange?: { from?: string; to?: string } | null;
  duplicateDates?: string[];
  unmappedMealLabels?: { label: string; count: number }[];
  sample?: {
    date: string;
    meal?: string;
    name: string;
    brand?: string;
    calories?: number | null;
  }[];
}

interface Committed {
  imported: number;
  skipped: number;
  replaced: number;
  merged: number;
  errors?: unknown;
}

export function NutritionImport() {
  const { t } = useTranslation("settings");
  const [source, setSource] = useState<Source>("spreadsheet");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [onDuplicate, setOnDuplicate] = useState<OnDuplicate>("skip");
  const [result, setResult] = useState<Committed | null>(null);
  const [energy] = useShared<string>(["nt", "energyUnit"]);
  const { isBusy, run } = useAction();
  const explain = useUploadError();

  const reset = () => {
    setFile(null);
    setPreview(null);
  };
  const form = (extra: Record<string, string> = {}) => {
    const data = new FormData();
    if (file) data.append("file", file);
    data.append("source", source);
    for (const [key, value] of Object.entries(extra)) data.append(key, value);
    return data;
  };
  const energyText = (calories: number) =>
    energy === "kJ"
      ? `${Math.round(calories * 4.184)} kJ`
      : `${Math.round(calories)} kcal`;
  const unmapped = preview?.unmappedMealLabels ?? [];

  return (
    <Stack gap={3}>
      <SelectRow<Source>
        label={t("importExport.apps.source")}
        hint={t(`importExport.apps.hints.${source}`)}
        value={source}
        options={SOURCES.map((value) => ({
          value,
          label: t(`importExport.apps.sources.${value}`),
        }))}
        onChange={(next) => {
          setSource(next);
          setResult(null);
          reset();
        }}
      />
      {source === "spreadsheet" ? (
        <ExternalLink
          href="/nt/templates/nutrition-import-template.csv"
          text={t("importExport.apps.template")}
        />
      ) : null}
      <FileInput
        accept={source === "mfp" ? ".csv,.zip" : ".csv"}
        text={t("importExport.chooseFile")}
        placeholder={t("importExport.noFile")}
        file={file}
        onChange={(picked) => {
          setFile(picked);
          setPreview(null);
          setResult(null);
        }}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("actions.preview")}
          isDisabled={!file}
          isLoading={isBusy && !preview}
          onClick={() =>
            void run(async () => {
              setPreview(
                await explain(
                  api.nt.post<Preview>("/nutrition-import/preview", form()),
                ),
              );
            })
          }
        />
      </Row>
      {preview ? (
        <Stack gap={2}>
          <Text role="status">
            {t("importExport.apps.stats", {
              items: preview.items,
              days: preview.days,
              existing: preview.duplicateDates?.length ?? 0,
              from: preview.dateRange?.from ?? "?",
              to: preview.dateRange?.to ?? "?",
            })}
          </Text>
          {unmapped.length ? (
            <Text variant="small" tone="warning">
              {t("importExport.apps.unmapped", {
                labels: unmapped
                  .slice(0, 6)
                  .map((entry) => `${entry.label} (${entry.count})`)
                  .join(", "),
              })}
              {unmapped.length > 6
                ? ` ${t("importExport.andMore", { count: unmapped.length - 6 })}`
                : ""}
            </Text>
          ) : null}
          {preview.sample?.map((row, index) => (
            <Text key={index} variant="small" tone="muted">
              {[
                row.date,
                row.meal,
                row.name,
                row.brand,
                row.calories != null ? energyText(row.calories) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ))}
          {preview.duplicateDates?.length ? (
            <SegmentRow<OnDuplicate>
              label={t("importExport.apps.duplicates")}
              value={onDuplicate}
              options={(["skip", "merge", "replace"] as const).map((value) => ({
                value,
                label: t(`importExport.apps.duplicate.${value}`),
              }))}
              onChange={setOnDuplicate}
            />
          ) : null}
          <Row gap={2}>
            <Button
              variant="primary"
              size="md"
              text={t("actions.import")}
              isLoading={isBusy}
              onClick={() =>
                void run(async () => {
                  setResult(
                    await explain(
                      api.nt.post<Committed>(
                        "/nutrition-import/commit",
                        form({ onDuplicate }),
                      ),
                    ),
                  );
                  reset();
                })
              }
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
      {result ? (
        <Text role="status" tone="success">
          {t("importExport.apps.done", {
            imported: result.imported,
            merged: result.merged,
            replaced: result.replaced,
            skipped: result.skipped,
          })}
        </Text>
      ) : null}
    </Stack>
  );
}
