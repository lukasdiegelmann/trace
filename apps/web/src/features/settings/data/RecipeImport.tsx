/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
/** CookTrace's recipe archive import (SettingsImport.svelte) */
import {
  Button,
  Checkbox,
  Chip,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { api, ApiError } from "@/api";

import { SegmentRow, SwitchRow } from "../common/fields";
import { useAction } from "../common/useAction";
import { useUploadError } from "../common/useUploadError";
import { useWakeLock } from "../common/useWakeLock";
import { PickFile } from "./PickFile";

interface ScannedRecipe {
  idx: number;
  name: string;
  source?: string;
  img_url?: string | null;
  thumb_data_url?: string | null;
  ingredient_count?: number;
  step_count?: number;
  timelineEventCount?: number;
}

interface Scan {
  count: number;
  uploadId: string | null;
  recipes: ScannedRecipe[];
}

interface Committed {
  count: number;
  failed?: { idx: number; name: string; error: string }[];
  skipped?: { idx: number; name: string; existing_id?: number }[];
  timelineImported?: number;
}

type Dedup = "skip" | "replace" | "force";

interface Options {
  import_images: boolean;
  addToPantry: boolean;
  applyTags: boolean;
  importCategories: boolean;
  import_timeline: boolean;
}

/**
 * A cut connection must not leave the spinner turning for ever. The old UI
 * watched the upload's progress, which fetch doesn't report.
 */
const UPLOAD_LIMIT_MS = 10 * 60 * 1000;
const limited = () => ({ signal: AbortSignal.timeout(UPLOAD_LIMIT_MS) });

const DEFAULTS: Options = {
  import_images: true,
  addToPantry: false,
  applyTags: true,
  importCategories: true,
  import_timeline: true,
};

export function RecipeImport() {
  const { t } = useTranslation("settings");
  const [file, setFile] = useState<File | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [options, setOptions] = useState(DEFAULTS);
  const [dedup, setDedup] = useState<Dedup>("skip");
  const [result, setResult] = useState<Committed | null>(null);
  const [phase, setPhase] = useState<"scanning" | "importing" | null>(null);
  const { run } = useAction();
  const explain = useUploadError();
  useWakeLock(phase !== null);
  const events = (scan?.recipes ?? []).reduce(
    (sum, recipe) => sum + (recipe.timelineEventCount ?? 0),
    0,
  );

  const during = async (
    next: "scanning" | "importing",
    action: () => Promise<void>,
  ) => {
    setPhase(next);
    await run(action);
    setPhase(null);
  };

  const upload = (chosen: File) => {
    setFile(chosen);
    setScan(null);
    setResult(null);
    void during("scanning", async () => {
      const form = new FormData();
      form.append("file", chosen);
      const answer = await explain(
        api.ct.post<Scan>("/recipes/import-zip/scan", form, limited()),
      );
      setScan(answer);
      setPicked(new Set(answer.recipes.map((recipe) => recipe.idx)));
    });
  };

  /** The old web client dropped dedup and cook history; both are sent here */
  const commit = () =>
    during("importing", async () => {
      if (!scan) return;
      const selected = [...picked];
      const resend = () => {
        const form = new FormData();
        if (file) form.append("file", file);
        form.append("selected", JSON.stringify(selected));
        for (const [key, value] of Object.entries({ ...options, dedup })) {
          form.append(key, String(value));
        }
        return api.ct.post<Committed>(
          "/recipes/import-zip/commit",
          form,
          limited(),
        );
      };
      const send = async () => {
        if (!scan.uploadId) return resend();
        try {
          return await api.ct.post<Committed>("/recipes/import-zip/commit", {
            uploadId: scan.uploadId,
            selected,
            ...options,
            dedup,
          });
        } catch (caught) {
          // The server dropped the scanned upload: send the file again.
          if (caught instanceof ApiError && caught.status === 410) {
            return resend();
          }
          throw caught;
        }
      };
      setResult(await explain(send()));
      setScan(null);
      setFile(null);
    });

  const toggle = (index: number, isOn: boolean) => {
    const next = new Set(picked);
    if (isOn) next.add(index);
    else next.delete(index);
    setPicked(next);
  };

  return (
    <Stack gap={3}>
      <Text variant="small" tone="muted">
        {t("importExport.recipes.description")}
      </Text>
      <PickFile
        accept=".zip,.paprikarecipes"
        text={t("importExport.chooseFile")}
        isDisabled={phase !== null}
        onPick={upload}
      />
      {phase ? (
        <Spinner label={t(`importExport.recipes.phases.${phase}`)} />
      ) : null}
      {scan ? (
        <Stack gap={2}>
          <Row gap={2} align="center" shouldWrap>
            <Text variant="small" role="status">
              {t("importExport.recipes.found", {
                count: scan.count,
                picked: picked.size,
              })}
            </Text>
            <Button
              variant="ghost"
              size="sm"
              text={t("actions.selectAll")}
              onClick={() => {
                setPicked(new Set(scan.recipes.map((r) => r.idx)));
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              text={t("actions.selectNone")}
              onClick={() => {
                setPicked(new Set());
              }}
            />
          </Row>
          {scan.recipes.map((recipe) => {
            const image = recipe.thumb_data_url || recipe.img_url;
            return (
              <Row key={recipe.idx} gap={2} align="center">
                {image ? (
                  <img
                    src={image}
                    alt=""
                    className="size-10 rounded-inner object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <Checkbox
                    label={`${recipe.name} · ${t(
                      "importExport.recipes.counts",
                      {
                        ingredients: recipe.ingredient_count ?? 0,
                        steps: recipe.step_count ?? 0,
                      },
                    )}`}
                    checked={picked.has(recipe.idx)}
                    onChange={(isOn) => {
                      toggle(recipe.idx, isOn);
                    }}
                  />
                </div>
                {recipe.source ? <Chip text={recipe.source} /> : null}
              </Row>
            );
          })}
          {(
            [
              "import_images",
              "addToPantry",
              "applyTags",
              "importCategories",
              ...(events > 0 ? (["import_timeline"] as const) : []),
            ] as const
          ).map((key) => (
            <SwitchRow
              key={key}
              label={t(`importExport.recipes.options.${key}`, {
                count: events,
              })}
              isChecked={options[key]}
              onChange={(isOn) => {
                setOptions((old) => ({ ...old, [key]: isOn }));
              }}
            />
          ))}
          <SegmentRow<Dedup>
            label={t("importExport.recipes.duplicates")}
            hint={
              dedup === "skip" && events > 0
                ? t("importExport.recipes.skipHistoryHint")
                : undefined
            }
            value={dedup}
            options={(["skip", "replace", "force"] as const).map((value) => ({
              value,
              label: t(`importExport.recipes.dedup.${value}`),
            }))}
            onChange={setDedup}
          />
          <Row>
            <Button
              variant="primary"
              size="md"
              text={t("importExport.recipes.import", { count: picked.size })}
              isDisabled={picked.size === 0 || phase !== null}
              onClick={() => void commit()}
            />
          </Row>
        </Stack>
      ) : null}
      {result ? (
        <Stack gap={1} role="status">
          <Text tone="success">
            {t("importExport.recipes.done", { count: result.count })}
          </Text>
          {result.skipped?.map((entry) => (
            <Text key={entry.idx} variant="small" tone="muted">
              {t("importExport.recipes.duplicate", { name: entry.name })}{" "}
              {entry.existing_id ? (
                // TODO(monolithium): an in-app text link.
                <Link
                  className="underline"
                  to={`/cooking/recipes/${entry.existing_id}`}
                >
                  {t("importExport.recipes.open")}
                </Link>
              ) : null}
            </Text>
          ))}
          {result.failed?.map((entry) => (
            <Text key={entry.idx} variant="small" tone="danger">
              {`${entry.name}: ${entry.error}`}
            </Text>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
