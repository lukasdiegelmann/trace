import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { settingsStores } from "@/features/shared/settings";

import { Section } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { activityCsv, diaryCsv, fullNutritionCsv } from "../lib/csvExport";
import { isoDate } from "../lib/dates";
import { downloadText } from "../lib/download";
import { stringList } from "../lib/lists";
import { NUTRIMENTS } from "../lib/nutrimentCatalog";
import { customNutrimentList } from "../lib/nutrientSettings";
import { BulkFoodImport } from "./BulkFoodImport";
import { PickFile } from "./PickFile";
import {
  allActivity,
  allDiary,
  buildPortableExport,
  importPortableFile,
} from "./nutritionData";

/** NutriTrace's JSON backup file and CSV exports */
export function NutritionFiles() {
  const { t } = useTranslation("settings");
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();
  const [isRestored, setIsRestored] = useState(false);
  const today = isoDate(new Date());

  const csv = (text: string, name: string) => {
    downloadText(text, `${name}-${today}.csv`, "text/csv");
  };
  const exports = [
    {
      id: "json",
      action: async () => {
        downloadText(
          JSON.stringify(await buildPortableExport(), null, 2),
          `nutritrace-backup-${today}.json`,
          "application/json",
        );
      },
    },
    {
      id: "diaryCsv",
      action: async () => {
        csv(diaryCsv(await allDiary()), "nutritrace-diary");
      },
    },
    {
      id: "fullCsv",
      action: async () => {
        const diary = await allDiary();
        await settingsStores.nt.ensureLoaded();
        const { mealNames, customNutriments } =
          settingsStores.nt.getSnapshot().values;
        csv(
          fullNutritionCsv(
            diary,
            stringList(mealNames),
            customNutrimentList(customNutriments),
            (id) => {
              const known = NUTRIMENTS.find((n) => n.id === id);
              return known ? t(`nutriment.${known.id}`) : id;
            },
          ),
          "nutritrace-diary-full",
        );
      },
    },
    {
      id: "activityCsv",
      action: async () => {
        csv(activityCsv(await allActivity()), "nutritrace-activity");
      },
    },
  ] as const;

  const restore = async (file: File) => {
    const isConfirmed = await confirm({
      title: t("importExport.json.restoreTitle"),
      message: t("importExport.json.restoreText", { name: file.name }),
      confirmText: t("actions.import"),
    });
    if (!isConfirmed) return;
    await run(
      async () => {
        await importPortableFile(await file.text());
        setIsRestored(true);
      },
      { success: t("importExport.json.restored") },
    );
  };

  return (
    <>
      <Section
        title={t("importExport.export")}
        hint={t("importExport.json.exportHint")}
      >
        <Row gap={2} shouldWrap>
          {exports.map((item) => (
            <Button
              key={item.id}
              variant="secondary"
              size="md"
              text={t(`importExport.exports.${item.id}`)}
              isDisabled={isBusy}
              onClick={() => void run(item.action)}
            />
          ))}
        </Row>
      </Section>
      <Section title={t("actions.import")}>
        <BulkFoodImport />
        <Stack gap={2}>
          <PickFile
            accept=".json,application/json"
            text={t("importExport.json.pick")}
            onPick={(file) => void restore(file)}
          />
          {isRestored ? (
            <Text role="status" tone="success">
              {t("importExport.json.restored")}
            </Text>
          ) : null}
        </Stack>
      </Section>
      {dialog}
    </>
  );
}
