import {
  Button,
  Dialog,
  Disclosure,
  FileInput,
  Row,
  SegmentedControl,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { useSetting } from "@/features/shared/settings";

import { TextRow } from "../common/fields";
import { useAction } from "../common/useAction";
import { downloadText } from "../lib/download";
import {
  buildCsvTemplate,
  buildJsonTemplate,
  parseFoodCsv,
  parseFoodJson,
  splitDuplicates,
  type FoodParse,
} from "../lib/foodImport";
import { libraryBarcodes } from "./nutritionData";

type Format = "json" | "csv";

const EMPTY: FoodParse = { valid: [], errors: [] };

/** Many foods at once from JSON or CSV (BulkImportModal.svelte) */
export function BulkFoodImport() {
  const { t } = useTranslation("settings");
  const toast = useToast();
  const [barcodes, setBarcodes] = useState<string[] | null>(null);
  const [format, setFormat] = useState<Format>("json");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { isBusy, run } = useAction();

  const parsed = useMemo(() => {
    if (!text.trim()) return EMPTY;
    return format === "json" ? parseFoodJson(text) : parseFoodCsv(text);
  }, [format, text]);
  const split = splitDuplicates(parsed.valid, barcodes ?? []);
  const [energyUnit] = useSetting("nt", "energyUnit");
  const energy = (calories: number | string | undefined) => {
    const kcal = Number(calories) || 0;
    return energyUnit === "kJ"
      ? `${Math.round(kcal * 4.184)} kJ`
      : `${Math.round(kcal)} kcal`;
  };
  /** "and N more" below a list that shows only its start */
  const more = (total: number, shown: number) =>
    total > shown ? (
      <Text variant="small" tone="muted">
        {t("importExport.bulk.more", { count: total - shown })}
      </Text>
    ) : null;

  const clear = () => {
    setText("");
    setFile(null);
  };
  const pick = async (picked: File | null) => {
    setFile(picked);
    if (picked) setText(await picked.text());
  };
  const commit = () =>
    run(async () => {
      await api.nt.post("/data/import", { foodList: split.ready });
      toast.show({
        text: t("importExport.bulk.done", {
          count: split.ready.length,
          skipped: split.duplicates.length,
        }),
      });
      setBarcodes(null);
      clear();
    });

  return (
    <>
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("importExport.bulk.open")}
          isLoading={isBusy && barcodes === null}
          onClick={() =>
            void run(async () => {
              // Duplicates are found by barcode, against today's library.
              setBarcodes(await libraryBarcodes().catch(() => []));
            })
          }
        />
      </Row>
      {barcodes !== null ? (
        <Dialog
          open
          size="lg"
          title={t("importExport.bulk.open")}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setBarcodes(null);
              clear();
            }
          }}
          cancelText={t("actions.cancel")}
          confirmText={t("importExport.bulk.confirm", {
            count: split.ready.length,
          })}
          isConfirmDisabled={
            parsed.errors.length > 0 || split.ready.length === 0
          }
          isBusy={isBusy}
          onConfirm={() => void commit()}
        >
          <Stack gap={3}>
            <Row>
              <SegmentedControl<Format>
                aria-label={t("importExport.bulk.format")}
                options={[
                  { value: "json", label: "JSON" },
                  { value: "csv", label: "CSV" },
                ]}
                value={format}
                onChange={(next) => {
                  setFormat(next);
                  clear();
                }}
              />
            </Row>
            <Row>
              <Button
                variant="ghost"
                size="sm"
                text={t("importExport.bulk.template")}
                onClick={() => {
                  downloadText(
                    format === "json"
                      ? buildJsonTemplate()
                      : buildCsvTemplate(),
                    `nutritrace-food-import-template.${format}`,
                    format === "json" ? "application/json" : "text/csv",
                  );
                }}
              />
            </Row>
            <FileInput
              accept={format === "json" ? ".json" : ".csv"}
              text={t("importExport.chooseFile")}
              placeholder={t("importExport.noFile")}
              file={file}
              onChange={(picked) => void pick(picked)}
            />
            {format === "json" ? (
              <TextRow
                isMultiline
                label={t("importExport.bulk.paste")}
                value={text}
                isLive
                onCommit={setText}
              />
            ) : null}
            {text.trim() ? (
              <Stack gap={1} role="status">
                <Text variant="small">
                  {t("importExport.bulk.preview", {
                    ready: split.ready.length,
                    duplicates: split.duplicates.length,
                    errors: parsed.errors.length,
                  })}
                </Text>
                {parsed.errors.length > 0 ? (
                  <Disclosure
                    title={t("importExport.bulk.errors")}
                    count={parsed.errors.length}
                    countTone="default"
                    defaultOpen
                  >
                    {parsed.errors.slice(0, 50).map((error) => (
                      <Text
                        key={`${error.row}-${error.code}`}
                        variant="small"
                        tone="danger"
                      >
                        {`${t("importExport.bulk.row", { row: error.row })}: ${t(`importExport.bulk.rowErrors.${error.code}`)}${error.detail ? ` (${error.detail})` : ""}`}
                      </Text>
                    ))}
                    {more(parsed.errors.length, 50)}
                  </Disclosure>
                ) : null}
                {split.duplicates.length > 0 ? (
                  <Disclosure
                    title={t("importExport.bulk.duplicates")}
                    count={split.duplicates.length}
                  >
                    {split.duplicates.slice(0, 50).map((food, index) => (
                      <Text key={index} variant="small" tone="muted">
                        {`${food.name} (${food.barcode ?? ""})`}
                      </Text>
                    ))}
                    {more(split.duplicates.length, 50)}
                  </Disclosure>
                ) : null}
                {split.ready.slice(0, 20).map((food, index) => (
                  <Text key={index} variant="small">
                    {`${food.name}${food.brand ? ` · ${food.brand}` : ""} · ${energy(food.nutrition.calories)} / ${food.portion} ${food.unit}`}
                  </Text>
                ))}
                {more(split.ready.length, 20)}
              </Stack>
            ) : null}
          </Stack>
        </Dialog>
      ) : null}
    </>
  );
}
